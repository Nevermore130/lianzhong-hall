import { createServer, type IncomingMessage } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { Accounts } from "./accounts.ts";
import { Hall } from "./hall.ts";
import type { User } from "../shared/protocol.ts";
import { createAccountRoutes, tokenOf, json } from "./account-routes.ts";
import { disabledMail, type MailDelivery } from "./mail.ts";
import { createChatRoutes } from "./chat-routes.ts";

export function createHallServer({
  database = ":memory:",
  allowedOrigin,
  linkOrigin = allowedOrigin ?? "http://127.0.0.1:5188",
  disconnectMs = 30_000,
  staticDir = resolve("dist"),
  mailer = disabledMail,
  now = () => Date.now(),
}: {
  database?: string;
  allowedOrigin?: string;
  linkOrigin?: string;
  disconnectMs?: number;
  staticDir?: string;
  mailer?: MailDelivery;
  now?: () => number;
} = {}) {
  const accounts = new Accounts(database, now),
    hall = new Hall(accounts, now);
  let closing = false;
  const clients = new Map<
    WebSocket,
    { user: User; token: string; count: number; since: number; alive: boolean }
  >();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const sameOrigin = (req: IncomingMessage) => {
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      return allowedOrigin
        ? origin === allowedOrigin
        : new URL(origin).host === req.headers.host;
    } catch {
      return false;
    }
  };
  const broadcast = (userId?: string) => {
    for (const [ws, client] of clients)
      if (
        ws.readyState === WebSocket.OPEN &&
        (!userId || client.user.id === userId)
      ) {
        if (ws.bufferedAmount > 1024 * 1024) {
          ws.close(1013, "连接过慢");
          continue;
        }
        ws.send(JSON.stringify(hall.snapshot(client.user)));
      }
  };
  const chatRoutes = createChatRoutes(accounts, hall, sameOrigin, broadcast);
  const routes = createAccountRoutes({
    accounts,
    hall,
    mailer,
    sameOrigin,
    linkOrigin,
    onChange: () => {
      if (closing) return;
      for (const [ws, client] of clients) {
        if (!accounts.resolve(client.token)) ws.close(4001, "登录状态已变化");
        else {
          hall.refreshUser(client.user.id);
        }
      }
      broadcast();
    },
  });
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (url.pathname === "/api/health") return json(res, 200, { ok: true });
      if (await chatRoutes(req, res, url)) return;
      if (await routes.handle(req, res, url)) return;
      if (req.method !== "GET" && req.method !== "HEAD")
        return json(res, 405, { error: "不支持的请求方法" });
      const file =
        url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
      const path = resolve(staticDir, `.${file}`);
      if (!path.startsWith(`${staticDir}/`))
        return json(res, 403, { error: "不可访问" });
      const mime: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".png": "image/png",
        ".json": "application/json; charset=utf-8",
      };
      try {
        const bytes = await readFile(path);
        res.writeHead(200, {
          "Content-Type": mime[extname(path)] ?? "application/octet-stream",
        });
        res.end(req.method === "HEAD" ? undefined : bytes);
      } catch {
        json(res, 404, { error: "页面不存在，请先 npm run build" });
      }
    } catch (error) {
      json(res, 400, {
        error: error instanceof Error ? error.message : "请求未能完成",
      });
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws" || !sameOrigin(req)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    const token = tokenOf(req),
      user = accounts.resolve(token);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      clients.set(ws, {
        user,
        token,
        count: 0,
        since: Date.now(),
        alive: true,
      });
      clearTimeout(timers.get(user.id));
      timers.delete(user.id);
      hall.connect(user);
      broadcast();
      ws.on("pong", () => {
        accounts.touch(token);
        const c = clients.get(ws);
        if (c) c.alive = true;
      });
      ws.on("error", () => ws.terminate());
      ws.on("message", (raw) => {
        const client = clients.get(ws);
        if (!client) return;
        if (!accounts.resolve(client.token)) {
          ws.close(4001, "登录已失效");
          return;
        }
        if (Date.now() - client.since > 5000) {
          client.since = Date.now();
          client.count = 0;
        }
        if (++client.count > 60) {
          ws.close(4008, "请求过于频繁");
          return;
        }
        let input: unknown;
        try {
          input = JSON.parse(raw.toString());
          const result = hall.dispatch(user.id, input);
          if (result) {
            ws.send(
              JSON.stringify({
                type: "chat:ack",
                clientId: result.message.clientId,
                message: result.message,
              }),
            );
            if (result.created) broadcast();
          } else broadcast();
        } catch (error) {
          const clientId =
            input &&
            typeof input === "object" &&
            "type" in input &&
            input.type === "chat" &&
            "clientId" in input &&
            typeof input.clientId === "string" &&
            input.clientId.length <= 64
              ? input.clientId
              : undefined;
          ws.send(
            JSON.stringify({
              type: clientId ? "chat:error" : "error",
              ...(clientId ? { clientId } : {}),
              message: error instanceof Error ? error.message : "操作未能完成",
            }),
          );
        }
      });
      ws.on("close", () => {
        clients.delete(ws);
        if (closing) return;
        if (![...clients.values()].some((c) => c.user.id === user.id)) {
          hall.offline(user.id);
          broadcast();
          timers.set(
            user.id,
            setTimeout(() => {
              hall.remove(user.id);
              timers.delete(user.id);
              broadcast();
            }, disconnectMs),
          );
        }
      });
    });
  });
  const heartbeat = setInterval(() => {
    for (const [ws, c] of clients) {
      if (!accounts.resolve(c.token)) {
        ws.close(4001, "登录已失效");
        continue;
      }
      if (!c.alive) {
        ws.terminate();
        continue;
      }
      c.alive = false;
      ws.ping();
    }
  }, 15_000);
  heartbeat.unref();
  async function close() {
    closing = true;
    clearInterval(heartbeat);
    for (const ws of clients.keys()) ws.terminate();
    for (const timer of timers.values()) clearTimeout(timer);
    await new Promise<void>((done) => wss.close(() => done()));
    await new Promise<void>((done) => {
      server.close(() => done());
      server.closeAllConnections();
    });
    await routes.close();
    accounts.db.close();
  }
  return { server, accounts, hall, close };
}

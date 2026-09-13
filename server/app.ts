import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { Accounts } from "./accounts.ts";
import { Hall } from "./hall.ts";
import type { User } from "../shared/protocol.ts";

const tokenOf = (req: IncomingMessage) =>
  req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("hall_session="))
    ?.slice(13) ?? "";
function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw new Error("请求内容过长");
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("请求格式不正确");
  return value;
}
export function createHallServer({
  database = ":memory:",
  allowedOrigin,
  disconnectMs = 30_000,
  staticDir = resolve("dist"),
}: {
  database?: string;
  allowedOrigin?: string;
  disconnectMs?: number;
  staticDir?: string;
} = {}) {
  const accounts = new Accounts(database),
    hall = new Hall(accounts);
  let closing = false;
  const clients = new Map<
    WebSocket,
    { user: User; token: string; count: number; since: number; alive: boolean }
  >();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const attempts = new Map<string, { count: number; since: number }>();
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
  const broadcast = () => {
    for (const [ws, client] of clients)
      if (ws.readyState === WebSocket.OPEN) {
        if (ws.bufferedAmount > 1024 * 1024) {
          ws.close(1013, "连接过慢");
          continue;
        }
        ws.send(JSON.stringify(hall.snapshot(client.user)));
      }
  };
  const revoke = (token: string) => {
    if (!token) return;
    accounts.revoke(token);
    for (const [ws, c] of clients)
      if (c.token === token) ws.close(4001, "登录已失效");
  };
  const cookie = (token: string, age = 604800) =>
    `hall_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (url.pathname === "/api/health") return json(res, 200, { ok: true });
      if (url.pathname === "/api/me" && req.method === "GET")
        return json(res, 200, { user: accounts.resolve(tokenOf(req)) });
      if (url.pathname.startsWith("/api/")) {
        if (req.method !== "POST")
          return json(res, 405, { error: "不支持的请求方法" });
        if (
          !sameOrigin(req) ||
          !req.headers["content-type"]?.includes("application/json")
        )
          return json(res, 403, { error: "请求来源不正确" });
        const ip = req.socket.remoteAddress ?? "unknown",
          now = Date.now();
        let rate = attempts.get(ip);
        if (!rate || now - rate.since > 60_000) {
          rate = { count: 0, since: now };
          attempts.set(ip, rate);
        }
        if (++rate.count > 20)
          return json(res, 429, { error: "操作太频繁，请一分钟后重试" });
        const data = await body(req),
          previous = tokenOf(req);
        if (url.pathname === "/api/logout") {
          revoke(previous);
          res.setHeader("Set-Cookie", cookie("", 0));
          return json(res, 200, { ok: true });
        }
        let user: User;
        if (url.pathname === "/api/guest") {
          const current = accounts.resolve(previous);
          if (current) return json(res, 200, { user: current });
          user = await accounts.create(null);
        } else if (url.pathname === "/api/register") {
          if (data.password === undefined) throw new Error("请输入密码");
          user = await accounts.create(data.name, data.password);
        } else if (url.pathname === "/api/login")
          user = await accounts.login(data.name, data.password);
        else return json(res, 404, { error: "接口不存在" });
        revoke(previous);
        res.setHeader("Set-Cookie", cookie(accounts.session(user)));
        return json(res, 200, { user });
      }
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
        try {
          hall.dispatch(user.id, JSON.parse(raw.toString()));
          broadcast();
        } catch (error) {
          ws.send(
            JSON.stringify({
              type: "error",
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
    for (const [ip, rate] of attempts)
      if (Date.now() - rate.since > 60_000) attempts.delete(ip);
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
    accounts.db.close();
  }
  return { server, accounts, hall, close };
}

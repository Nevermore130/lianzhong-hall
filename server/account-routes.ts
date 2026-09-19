import type { IncomingMessage, ServerResponse } from "node:http";
import type { Accounts } from "./accounts.ts";
import type { Hall } from "./hall.ts";
import type { User } from "../shared/protocol.ts";
import { AccountError } from "./account-errors.ts";
import type { AccountMail, MailDelivery } from "./mail.ts";

export const tokenOf = (req: IncomingMessage) =>
  req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("hall_session="))
    ?.slice(13) ?? "";
export function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}
export async function body(
  req: IncomingMessage,
): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw new AccountError("请求内容过长", 413);
    chunks.push(chunk);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    throw new AccountError("请求格式不正确");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AccountError("请求格式不正确");
  return value as Record<string, unknown>;
}
export function createAccountRoutes({
  accounts,
  hall,
  mailer,
  linkOrigin,
  sameOrigin,
  onChange,
}: {
  accounts: Accounts;
  hall: Hall;
  mailer: MailDelivery;
  linkOrigin: string;
  sameOrigin: (req: IncomingMessage) => boolean;
  onChange: () => void;
}) {
  const attempts = new Map<string, { count: number; since: number }>();
  const pending = new Set<Promise<void>>();
  // Only set Secure flag when serving over HTTPS; browsers reject Secure cookies on plain HTTP
  const cookie = (token: string, age = 604800) =>
    `hall_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${linkOrigin.startsWith("https:") ? "; Secure" : ""}`;
  const notify = () => setImmediate(onChange);
  const origin = new URL(linkOrigin).origin;
  const deliver = async (
    verification: { token: string; email: string },
    purpose: "email" | "reset",
  ) => {
    const mail: AccountMail = {
      to: verification.email,
      subject: purpose === "email" ? "验证游戏账号邮箱" : "重置游戏账号密码",
      text:
        purpose === "email"
          ? "请打开下方链接，确认将此邮箱绑定到你的游戏账号。链接 15 分钟内有效，仅可使用一次。验证后需要重新登录。"
          : "请打开下方链接设置新密码。链接 15 分钟内有效，仅可使用一次。重置后所有设备需要重新登录。如果不是你申请的，请忽略此邮件。",
      link: `${origin}/#${purpose === "email" ? "verify-email" : "reset-password"}=${verification.token}`,
    };
    try {
      await mailer.send(mail);
    } catch {
      accounts.discardVerification(verification.token);
      throw new AccountError("邮件发送失败，请稍后重试", 503);
    }
  };
  const queueReset = (verification: { token: string; email: string }) => {
    const task = deliver(verification, "reset").catch(() => {
      console.error("账号找回邮件发送失败，请检查邮件服务配置");
    });
    pending.add(task);
    void task.finally(() => pending.delete(task));
  };
  return {
    async close() {
      await Promise.allSettled([...pending]);
    },
    async handle(
      req: IncomingMessage,
      res: ServerResponse,
      url: URL,
    ): Promise<boolean> {
      if (!url.pathname.startsWith("/api/")) return false;
      const path = url.pathname.slice(5),
        previous = tokenOf(req);
      const identity = () => {
        const user = accounts.resolve(previous);
        if (!user) throw new AccountError("登录已失效，请重新登录", 401);
        return user;
      };
      const member = () => {
        const user = identity();
        if (user.guest) throw new AccountError("请先将游客转为正式账号", 403);
        return user;
      };
      const guard =
        (user: User, blockPlaying = false) =>
        () => {
          if (identity().id !== user.id)
            throw new AccountError("账号已切换，请重新操作", 409);
          if (blockPlaying && hall.isPlaying(user.id))
            throw new AccountError("请先完成当前对局，再进行此操作", 409);
        };
      const signedIn = (user: User) => {
        const token = accounts.session(user, req.headers["user-agent"] ?? "");
        res.setHeader("Set-Cookie", cookie(token));
        hall.refreshUser(user.id);
        json(res, 200, { user });
        notify();
      };
      try {
        if (!sameOrigin(req)) throw new AccountError("请求来源不正确", 403);
        if (req.method === "GET") {
          if (path === "me")
            json(res, 200, { user: accounts.resolve(previous) });
          else if (path === "account") {
            const user = identity();
            json(res, 200, {
              profile: accounts.profile(user.id),
              mailMode: mailer.mode,
              inboxUrl: mailer.inboxUrl,
            });
          } else if (path === "sessions") {
            const user = member();
            json(res, 200, { sessions: accounts.sessions(user.id, previous) });
          } else if (path === "auth/config")
            json(res, 200, {
              mailMode: mailer.mode,
              inboxUrl: mailer.inboxUrl,
            });
          else json(res, 404, { error: "接口不存在" });
          return true;
        }
        if (req.method !== "POST")
          throw new AccountError("不支持的请求方法", 405);
        if (!req.headers["content-type"]?.includes("application/json"))
          throw new AccountError("请求格式不正确", 403);
        const auth = [
          "login",
          "register",
          "guest",
          "password/forgot",
          "password/reset",
          "email/confirm",
        ].includes(path);
        const now = Date.now(),
          key = `${req.socket.remoteAddress ?? "unknown"}:${auth ? "auth" : "account"}`,
          limit = auth ? 20 : 60;
        for (const [k, v] of attempts)
          if (now - v.since > 60_000) attempts.delete(k);
        const rate = attempts.get(key) ?? { count: 0, since: now };
        attempts.set(key, rate);
        if (++rate.count > limit)
          throw new AccountError("操作太频繁，请一分钟后重试", 429, 60);
        const data = await body(req);
        if (path === "logout") {
          accounts.revoke(previous);
          res.setHeader("Set-Cookie", cookie("", 0));
          json(res, 200, { ok: true });
          notify();
          return true;
        }
        if (path === "guest") {
          const current = accounts.resolve(previous);
          if (current) json(res, 200, { user: current });
          else signedIn(await accounts.create(null));
          return true;
        }
        if (path === "register") {
          if (data.password === undefined) throw new AccountError("请输入密码");
          const current = accounts.resolve(previous);
          if (current && !current.guest)
            throw new AccountError("当前已是正式账号，请先退出后再注册", 409);
          const user = current
            ? await accounts.upgrade(
                current.id,
                data.name,
                data.password,
                guard(current),
              )
            : await accounts.create(data.name, data.password);
          accounts.revoke(previous);
          signedIn(user);
          return true;
        }
        if (path === "login") {
          const current = accounts.resolve(previous);
          if (current && hall.isPlaying(current.id))
            throw new AccountError("请先完成对局再切换账号", 409);
          const user = await accounts.login(data.name, data.password);
          if (current && hall.isPlaying(current.id))
            throw new AccountError("请先完成对局再切换账号", 409);
          accounts.revoke(previous);
          signedIn(user);
          return true;
        }
        if (path === "session/refresh") {
          const result = accounts.renew(previous);
          res.setHeader("Set-Cookie", cookie(previous, result.maxAge));
          json(res, 200, { user: result.user });
          return true;
        }
        if (path === "password/forgot") {
          if (mailer.mode === "disabled")
            throw new AccountError("邮件服务尚未配置，请联系管理员", 503);
          const verification = accounts.prepareReset(data.email);
          if (verification) queueReset(verification);
          json(res, 200, {
            ok: true,
            message: "如果该邮箱已绑定账号，你会收到密码重置邮件。",
          });
          return true;
        }
        if (path === "password/reset") {
          await accounts.resetPassword(data.token, data.password);
          json(res, 200, { ok: true });
          notify();
          return true;
        }
        if (path === "email/confirm") {
          accounts.confirmEmail(data.token);
          json(res, 200, { ok: true });
          notify();
          return true;
        }
        const user = member();
        if (path === "profile") {
          const updated = accounts.updateProfile(
            user.id,
            data.name,
            data.avatar,
          );
          hall.refreshUser(user.id);
          json(res, 200, { user: updated });
          notify();
        } else if (path === "password/change") {
          const updated = await accounts.changePassword(
            user.id,
            data.currentPassword,
            data.newPassword,
            guard(user),
          );
          signedIn(updated);
        } else if (path === "email/request") {
          if (mailer.mode === "disabled")
            throw new AccountError("邮件服务尚未配置，请联系管理员", 503);
          const verification = await accounts.prepareEmail(
            user.id,
            data.email,
            data.password,
            guard(user),
          );
          await deliver(verification, "email");
          json(res, 200, { ok: true });
        } else if (path === "sessions/revoke") {
          accounts.revokeDevice(user.id, data.sessionId, previous);
          json(res, 200, { ok: true });
          notify();
        } else if (path === "sessions/revoke-others") {
          await accounts.revokeOthers(
            user.id,
            previous,
            data.password,
            guard(user),
          );
          json(res, 200, { ok: true });
          notify();
        } else if (path === "account/delete") {
          await accounts.deleteAccount(
            user.id,
            data.password,
            data.confirmation,
            guard(user, true),
          );
          hall.forgetUser(user.id);
          res.setHeader("Set-Cookie", cookie("", 0));
          json(res, 200, { ok: true });
          notify();
        } else json(res, 404, { error: "接口不存在" });
      } catch (error) {
        const known = error instanceof AccountError;
        if (known && error.retryAfter)
          res.setHeader("Retry-After", String(error.retryAfter));
        if (!known)
          console.error(
            "账号请求处理失败",
            error instanceof Error ? error.name : "UnknownError",
          );
        json(res, known ? error.status : 500, {
          error: known ? error.message : "服务暂时不可用，请稍后重试",
          ...(known && error.retryAfter
            ? { retryAfter: error.retryAfter }
            : {}),
        });
      }
      return true;
    },
  };
}

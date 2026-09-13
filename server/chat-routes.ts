import type { IncomingMessage, ServerResponse } from "node:http";
import type { Accounts } from "./accounts.ts";
import type { Hall } from "./hall.ts";
import { body, json, tokenOf } from "./account-routes.ts";
import { AccountError } from "./account-errors.ts";

export function createChatRoutes(
  accounts: Accounts,
  hall: Hall,
  sameOrigin: (req: IncomingMessage) => boolean,
  changed: (userId: string) => void,
) {
  return async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    if (!url.pathname.startsWith("/api/chat/")) return false;
    try {
      if (!sameOrigin(req)) throw new AccountError("请求来源不正确", 403);
      const user = accounts.resolve(tokenOf(req));
      if (!user) throw new AccountError("登录已失效，请重新登录", 401);
      if (url.pathname === "/api/chat/history" && req.method === "GET") {
        const channel = hall.chatChannel(
          user.id,
          url.searchParams.get("channel"),
        );
        const before = url.searchParams.get("before");
        json(
          res,
          200,
          hall.chat.page(
            user.id,
            channel,
            before === null ? undefined : Number(before),
          ),
        );
      } else if (url.pathname === "/api/chat/read" && req.method === "POST") {
        if (!req.headers["content-type"]?.includes("application/json"))
          throw new AccountError("请求格式不正确", 403);
        const data = await body(req);
        if (accounts.resolve(tokenOf(req))?.id !== user.id)
          throw new AccountError("登录已失效", 401);
        const channel = hall.chatChannel(user.id, data.channel);
        const updated = hall.chat.markRead(user.id, channel, data.through);
        json(res, 200, { ok: true });
        if (updated) changed(user.id);
      } else throw new AccountError("接口或请求方法不存在", 404);
    } catch (error) {
      json(res, error instanceof AccountError ? error.status : 500, {
        error:
          error instanceof AccountError ? error.message : "聊天服务暂时不可用",
      });
    }
    return true;
  };
}

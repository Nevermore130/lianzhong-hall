import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { AccountError } from "./account-errors.ts";
import type { MailMode } from "../shared/accounts.ts";

export type AccountMail = {
  to: string;
  subject: string;
  text: string;
  link: string;
};
export type MailDelivery = {
  mode: MailMode;
  inboxUrl?: string;
  send: (mail: AccountMail) => Promise<void>;
  close?: () => Promise<void>;
};
export const disabledMail: MailDelivery = {
  mode: "disabled",
  async send() {
    throw new AccountError("邮件服务尚未配置，请联系管理员", 503);
  },
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export async function localMailbox(port = 3089): Promise<MailDelivery> {
  const messages: (AccountMail & { id: string; time: number })[] = [];
  const server = createServer((req, res) => {
    const actualPort = (server.address() as { port: number }).port;
    if (
      ![`127.0.0.1:${actualPort}`, `localhost:${actualPort}`].includes(
        req.headers.host ?? "",
      )
    ) {
      res.writeHead(403).end();
      return;
    }
    if (req.method !== "GET" || req.url !== "/") {
      res.writeHead(404).end();
      return;
    }
    const live = messages.filter((m) => m.time > Date.now() - 15 * 60_000);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
    });
    res.end(
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>游戏大厅 · 本地邮件收件箱</title><style>body{font:14px Tahoma,'SimSun',serif;background:#c0c0c0;color:#202020;margin:20px auto;max-width:760px;padding:0 12px}h1{font-size:17px;background:#000080;color:white;padding:10px}article{background:#fff;padding:16px;margin:12px 0;border:2px inset #ddd}h2{font-size:15px}p{line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}a{color:#000080}small{color:#555}</style><h1>游戏大厅 · 本地邮件收件箱</h1><p>邮件仅保存在本机内存中，不会发往外部邮箱。只显示最近 15 分钟的邮件。</p><a href="/">刷新收件箱</a>${
        live.length
          ? live
              .slice()
              .reverse()
              .map(
                (m) =>
                  `<article><h2>${escape(m.subject)}</h2><small>收件人：${escape(m.to)} · ${new Date(m.time).toLocaleTimeString("zh-CN")}</small><p>${escape(m.text)}</p><a href="${escape(m.link)}" rel="noreferrer">打开验证链接</a></article>`,
              )
              .join("")
          : "<p>暂无邮件，请先在大厅发送验证邮件。</p>"
      }</html>`,
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address() as { port: number };
  return {
    mode: "local",
    inboxUrl: `http://127.0.0.1:${address.port}/`,
    async send(mail) {
      messages.push({ ...mail, id: randomUUID(), time: Date.now() });
      messages.splice(0, Math.max(0, messages.length - 50));
    },
    close: () => closeServer(server),
  };
}
function closeServer(server: Server) {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
}
export async function configuredMail(
  env: NodeJS.ProcessEnv = process.env,
): Promise<MailDelivery> {
  const mode =
    env.MAIL_MODE ?? (env.NODE_ENV === "production" ? "disabled" : "local");
  if (mode === "disabled") return disabledMail;
  if (mode === "local") {
    if (env.NODE_ENV === "production")
      throw new Error(
        "生产环境不能启用本地邮件收件箱，请配置 SMTP 或 MAIL_MODE=disabled",
      );
    return localMailbox(Number(env.MAIL_INBOX_PORT ?? 3089));
  }
  if (mode !== "smtp" || !env.SMTP_HOST || !env.SMTP_FROM || !env.APP_ORIGIN)
    throw new Error(
      "SMTP 需要配置 MAIL_MODE=smtp、SMTP_HOST、SMTP_FROM 和 APP_ORIGIN",
    );
  const origin = new URL(env.APP_ORIGIN);
  if (origin.protocol !== "https:")
    throw new Error("SMTP 正式邮件链接需配置 HTTPS APP_ORIGIN");
  const port = Number(env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return {
    mode: "smtp",
    async send(mail) {
      await transport.sendMail({
        from: env.SMTP_FROM,
        to: mail.to,
        subject: mail.subject,
        text: `${mail.text}\n\n${mail.link}`,
      });
    },
    async close() {
      transport.close();
    },
  };
}

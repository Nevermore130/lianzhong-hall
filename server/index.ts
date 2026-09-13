import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHallServer } from "./app.ts";
import { configuredMail } from "./mail.ts";
if (existsSync(".env")) process.loadEnvFile();
const mailer = await configuredMail();
const database = resolve(process.env.DATABASE_PATH ?? "data/hall.sqlite");
mkdirSync(dirname(database), { recursive: true });
const port = Number(process.env.PORT ?? 3088),
  host = process.env.HOST ?? "127.0.0.1";
const app = createHallServer({
  database,
  mailer,
  allowedOrigin: process.env.APP_ORIGIN,
  linkOrigin:
    process.env.APP_ORIGIN ??
    (process.env.npm_lifecycle_event === "dev"
      ? "http://127.0.0.1:5188"
      : `http://127.0.0.1:${port}`),
});
app.server.listen(port, host, () =>
  console.log(`游戏大厅服务已启动 http://${host}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void app
      .close()
      .then(() => mailer.close?.())
      .then(() => process.exit(0));
  });

if (mailer.inboxUrl) console.log(`本地邮件收件箱：${mailer.inboxUrl}`);

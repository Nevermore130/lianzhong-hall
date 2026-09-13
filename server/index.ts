import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHallServer } from "./app.ts";
const database = resolve(process.env.DATABASE_PATH ?? "data/hall.sqlite");
mkdirSync(dirname(database), { recursive: true });
const app = createHallServer({
  database,
  allowedOrigin: process.env.APP_ORIGIN,
});
const port = Number(process.env.PORT ?? 3088),
  host = process.env.HOST ?? "127.0.0.1";
app.server.listen(port, host, () =>
  console.log(`游戏大厅服务已启动 http://${host}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });

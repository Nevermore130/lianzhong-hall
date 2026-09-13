# 身份与大厅协议 v0.1

开发时从 5188 同源访问所有接口。构建部署时静态网页与服务共用一个地址。

## HTTP

| 接口                 | 输入              | 响应                                    |
| -------------------- | ----------------- | --------------------------------------- |
| `GET /api/health`    | 无                | `{ok:true}`                             |
| `GET /api/me`        | Cookie            | `{user: User                            | null}` |
| `POST /api/guest`    | `{}`              | `{user}` + Cookie；已有有效身份时保留   |
| `POST /api/register` | `{name,password}` | `{user}` + 新 Cookie                    |
| `POST /api/login`    | `{name,password}` | `{user}` + 新 Cookie                    |
| `POST /api/logout`   | `{}`              | `{ok:true}`；撤销当前会话、关闭关联连接 |

POST 需 `Content-Type: application/json`。浏览器 Origin 必须与请求 Host 对应，或与显式配置的 APP_ORIGIN 一致。请求体上限 4096 字节，同 IP 每分钟最多 20 次 POST。错误响应 `{error:string}`。未连接数据库以外的第三方登录服务。

Cookie：`hall_session`，HttpOnly、SameSite=Strict、7 天有效；生产环境加 Secure。数据库仅保存会话 token 的 SHA-256 哈希。注册昵称 2–16 位中文/字母/数字/下划线/连字符，NFKC 归一化；密码 8–72 位，scrypt 加随机盐。

## WebSocket

连接 `/ws`，升级阶段用相同 Cookie 认证；未登录拒绝升级。每条消息最大 4096 字节，每条连接 5 秒最多 60 条消息。服务器每 15 秒 ping，清理失活连接。

命令精确定义见 `shared/protocol.ts`。没有任何命令接受客户端自报 userId。

| type     | 其他字段                | 作用                                          |
| -------- | ----------------------- | --------------------------------------------- |
| `create` | `name, game:'gomoku'`   | 创建并进入房间；房间名 2–16 字；总房间上限 30 |
| `join`   | `roomId`                | 旁观方式进房；每房观战席最多 20 人            |
| `leave`  | 无                      | 离房；对局中的棋手离房判负                    |
| `sit`    | `seat:0                 | 1`                                            | 入座；0 黑，1 白 |
| `stand`  | 无                      | 非对局状态站起                                |
| `ready`  | 无                      | 切换准备；双方在线且都准备后开局              |
| `move`   | `index:0..224, matchId` | 本局落子；行优先索引                          |
| `resign` | 无                      | 认输                                          |
| `chat`   | `text`                  | 大厅消息，1–200 字，间隔至少 800ms            |

服务器事件：

```ts
{
  type: ("snapshot", me, players, rooms, messages, roomId);
}
{
  type: ("error", message);
}
```

快照包含最近 80 条大厅消息，所有房间的公开棋盘，以及当前在线/暂时离线玩家。用户名由服务端提供，界面用 React 文本渲染避免 HTML 注入。错误事件不修改棋局。

下一阶段考虑 requestId/ACK、schemaVersion、房间版本号、增量事件序列以及按用户的私有状态投影。首次连接和重连仍需保留完整快照通道。

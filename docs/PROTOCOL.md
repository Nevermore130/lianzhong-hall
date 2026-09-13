# 身份与大厅协议 v0.5

开发时从 5188 同源访问所有接口。构建部署时静态网页与服务共用一个地址。

## HTTP

| 接口                               | 输入                                         | 响应                                                      |
| ---------------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| `GET /api/health`                  | 无                                           | `{ok:true}`                                               |
| `GET /api/me`                      | Cookie                                       | `{user: User 或 null}`                                    |
| `POST /api/guest`                  | `{}`                                         | `{user}` + Cookie；已有有效身份时保留                     |
| `POST /api/register`               | `{name,password}`                            | `{user}` + 新 Cookie；有效游客原地转正并保留战绩          |
| `POST /api/login`                  | `{name,password}`，name 支持昵称或已验证邮箱 | `{user}` + 新 Cookie                                      |
| `POST /api/logout`                 | `{}`                                         | `{ok:true}`；撤销当前会话、关闭关联连接                   |
| `GET /api/auth/config`             | 无                                           | `{mailMode,inboxUrl?}`                                    |
| `GET /api/account`                 | Cookie                                       | `{profile,mailMode,inboxUrl?}`；profile 包含私有邮箱      |
| `POST /api/profile`                | `{name,avatar}`                              | `{user}`；头像为 0–5 的预设编号                           |
| `POST /api/password/change`        | `{currentPassword,newPassword}`              | `{user}` + 新 Cookie；其他会话失效                        |
| `POST /api/email/request`          | `{email,password}`                           | `{ok:true}`；发送绑定/换绑验证邮件                        |
| `POST /api/email/confirm`          | `{token}`                                    | `{ok:true}`；确认绑定，所有会话失效                       |
| `POST /api/password/forgot`        | `{email}`                                    | `{ok:true,message}`；有效邮箱统一响应，不暴露账号是否存在 |
| `POST /api/password/reset`         | `{token,password}`                           | `{ok:true}`；全部会话失效，不自动登录                     |
| `POST /api/session/refresh`        | `{}` + Cookie                                | `{user}` + 续期 Cookie                                    |
| `GET /api/sessions`                | Cookie                                       | `{sessions: DeviceSession[]}`                             |
| `POST /api/sessions/revoke`        | `{sessionId}`                                | `{ok:true}`；只能撤销本人非当前会话                       |
| `POST /api/sessions/revoke-others` | `{password}`                                 | `{ok:true}`；保留当前会话                                 |
| `POST /api/account/delete`         | `{password,confirmation:当前昵称}`           | `{ok:true}` + 清除 Cookie；对局中返回 409                 |

POST 需 `Content-Type: application/json`。浏览器 Origin 必须与请求 Host 对应，或与显式配置的 APP_ORIGIN 一致。请求体上限 4096 字节，同 IP 每分钟最多 20 次身份认证/找回 POST、60 次其他账号 POST。错误响应 `{error:string,retryAfter?:number}`，限流还返回 `Retry-After`。未登录 401，权限/来源错误 403，状态冲突 409，限流 429，邮件不可用 503。未连接数据库以外的第三方登录服务。

Cookie：`hall_session`，HttpOnly、SameSite=Strict、7 天未续期失效，创建满 30 天强制失效；生产环境加 Secure。数据库仅保存会话 token 的 SHA-256 哈希。注册昵称 2–16 位中文/字母/数字/下划线/连字符，NFKC 归一化；密码 8–72 位，scrypt 加随机盐。

正式账号才可编辑资料、修改密码、绑定邮箱、管理设备和注销。邮箱验证令牌与重置令牌各自限定用途，均为 32 字节随机值的 64 位十六进制字符串，仅存哈希，15 分钟有效且只可使用一次；同一用途邮件间隔至少 60 秒，重发会替换旧链接。令牌通过 URL fragment 进入表单，页面立即移除地址栏 fragment，再 POST 验证。

登录的昵称/邮箱别名按同一账号累计密码失败；15 分钟内连续 5 次后锁定 15 分钟，之后允许重试，成功登录清除失败记录。敏感操作的当前密码验证也有独立的单账号限制。密码找回成功会解除锁定。

`User` 公开字段仅有 `id,name,guest,wins,losses,avatar`；邮箱及创建时间由私有 `AccountProfile` 返回。`DeviceSession` 返回 `id,device,createdAt,lastSeenAt,expiresAt,current`，不包含 Cookie token 或其哈希。设备摘要来自浏览器 UA，不保证是一台唯一的物理设备。

## WebSocket

连接 `/ws`，升级阶段用相同 Cookie 认证；未登录拒绝升级。每条消息最大 4096 字节，每条连接 5 秒最多 60 条消息。服务器每 15 秒 ping，清理失活连接。

命令精确定义见 `shared/protocol.ts`。没有任何命令接受客户端自报 userId。

| type       | 其他字段                                       | 作用                                               |
| ---------- | ---------------------------------------------- | -------------------------------------------------- |
| `create`   | `name, game:'gomoku' / 'xiangqi' / 'doudizhu'` | 创建并进入房间；房间名 2–16 字；总房间上限 30      |
| `join`     | `roomId`                                       | 旁观方式进房；每房观战席最多 20 人                 |
| `leave`    | 无                                             | 离房；对局中的棋手离房判负                         |
| `sit`      | `seat:0 或 1 或 2`                             | 五子棋 0 黑/1 白，象棋 0 红/1 黑；斗地主 0–2       |
| `stand`    | 无                                             | 非对局状态站起                                     |
| `ready`    | 无                                             | 切换准备；对应游戏全席在线且都准备后开局           |
| `move`     | `index:0..224, matchId`                        | 本局落子；行优先索引                               |
| `ddz:bid`  | `score:0..3,matchId,revision`                  | 0 不叫；正分必须高于当前叫分，3 分立即定地主       |
| `ddz:play` | `cards:number[],matchId,revision`              | 出牌；必须持有全部牌、牌型合法且能压过上手         |
| `ddz:pass` | `matchId,revision`                             | 不出；自由领出时不可不出                           |
| `resign`   | 无                                             | 认输                                               |
| `chat`     | `text,channel,clientId`                        | 大厅或当前房间消息；1–200 字，同账号间隔至少 800ms |

服务器事件：

```ts
type ServerEvent =
  | {
      type: "snapshot";
      me: User;
      players: Player[];
      rooms: Room[];
      messages: Message[]; // 系统广播
      chat: ChatSnapshot; // hall、当前 room（或 null）、历史修订号 revision
      roomId: string | null;
    }
  | { type: "error"; message: string }
  | { type: "chat:ack"; clientId: string; message: ChatMessage }
  | { type: "chat:error"; clientId: string; message: string };
```

快照包含最近 80 条系统广播、大厅及当前房间各最近 50 条聊天与未读数、所有房间的公开对局状态，以及当前在线/暂时离线玩家。斗地主房间逐用户投影，只附上本人手牌。房间聊天不出现在其他房间或大厅玩家的快照中。用户名由服务端提供，界面用 React 文本渲染避免 HTML 注入。错误事件不修改棋局。

对局命令仍以新快照确认成功，没有独立 requestId/ACK；下一阶段考虑 schemaVersion 和增量事件。首次连接和重连保留完整快照通道。

## 斗地主状态

`Room` 是按 `game` 区分的联合类型。斗地主有三个席位，`match` 为 `DoudizhuView | null`，完整定义在 `shared/doudizhu.ts`。主要字段：

| 字段                          | 含义                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `id,revision`                 | 对局 ID 与每次有效动作递增的版本；旧版本被拒绝，防止重复出牌和轮次回绕后执行旧命令  |
| `status,phase`                | status 为 playing/finished；phase 为 bidding/playing/finished；叫分也属于进行中对局 |
| `turn,landlord,bids,bid,deal` | 当前席位、已确定地主或 null、三席叫分、最高叫分、发牌次数                           |
| `hand,counts`                 | 本人的剩余手牌和三家剩余张数；观众 hand 始终为空                                    |
| `bottom`                      | 叫分时为空；地主确定后公开三张底牌；叫分取消后仍为空                                |
| `lastPlay,passes,actions`     | 当前待压牌组、连续不出次数、三席最近出牌/不出提示；两家不出后重置牌组               |
| `multiplier,spring`           | 炸弹/王炸/春天倍数与春天标记                                                        |
| `winner,reason,scores`        | landlord/farmers/null、结束原因、三席本局得分；无赢家的取消局不增减战绩             |

`Card` 用 0–53 编号。0–51 的点数为 `floor(id/4)+3`（3 至 A、2），`id%4` 依次为黑桃、红桃、梅花、方块；52 小王，53 大王。内部 `hands` 三份手牌及其他内部字段从不直接序列化。客户端不能指定地主、发牌结果、胜者或分数。

三个 `ddz:*` 命令均要求操作者已经入座、全员在线、轮到本人、ID 与 revision 匹配。叫分阶段只接受 bid；出牌阶段只接受 play/pass。非法命令返回 error，不推进版本。前端等待新快照后扣牌并解除发送中状态，5 秒未确认则允许手动重试；服务端版本校验阻止已经执行的命令再次生效。

出完手牌、认输或出牌阶段离开/断线超时会按阵营结算；叫分阶段退出则取消，不计胜负。战绩三人同事务更新。刷新仍连接原进程时恢复当前手牌，服务重启后不能恢复进行中对局。

## 聊天协议

`channel` 为 `hall` 或 `room:<房间编号>`。客户端不能自报发送人；服务端通过会话确定账号，房间权限通过大厅的当前成员状态校验。聊天 HTTP 接口同样要求有效 Cookie、同源和在线大厅连接。

| 接口                    | 输入                                          | 返回                                                        |
| ----------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| `GET /api/chat/history` | 查询参数 `channel`、可选 `before`（消息 seq） | `ChatPage`，按序号升序的最多 50 条消息、`hasMore`、`unread` |
| `POST /api/chat/read`   | `{channel,through:seq}`                       | `{ok:true}`；单调更新本人已读位置，同账号其他连接会收到更新 |

```ts
type ChatMessage = {
  id: string;
  seq: number;
  clientId: string;
  channel: "hall" | `room:${string}`;
  userId: string;
  name: string;
  text: string;
  time: number;
};
type ChatPage = {
  channel: ChatMessage["channel"];
  messages: ChatMessage[];
  hasMore: boolean;
  unread: number;
};
type ChatSnapshot = { revision: number; hall: ChatPage; room: ChatPage | null };
```

发送使用 WebSocket `{type:"chat",channel,clientId,text}`，`clientId` 由客户端生成 UUID。消息写入完成后才发 `chat:ack`；错误用同编号的 `chat:error` 返回。`(user_id,client_id)` 是数据库唯一键，重复原文/原频道请求返回原消息，不受新消息限频影响；重复编号配不同原文或频道会被拒绝。

客户端 8 秒未收到确认时显示可重试状态。重试保持编号和原文；改写后作为新消息发送。服务端快照也能确认本人已落库的待发消息，避免确认包丢失后重复显示。

`before` 是排他的单调序号游标，与发送时间无关。刷新/重连获取最新一页，更早消息通过历史接口读取；重连跨度超过一页时重置到最新区间并保留历史分页入口，避免拼出不可补齐的历史空洞。

未读数统计已读位置之后其他人的消息，自己的消息不计入；首次订阅频道将当时最新位置作为基线。浏览器不会在后台标签页、账号弹窗遮挡或向上翻阅时更新已读位置。账户注销通过外键级联删除其聊天和已读记录，同时递增 `revision`，客户端收到修订号变化后清空旧历史缓存并采用新快照。

## 中国象棋状态与命令

象棋房间 game 为 xiangqi，seats 是红、黑两个席位，match 为 `XiangqiState | null`。board 为 90 项行优先数组，0 是黑方左上角，89 是红方右下角；空交点为 null，棋子为 `{side:1|2,kind}`，kind 为 king/advisor/elephant/horse/rook/cannon/pawn。turn 使用 1 红/2 黑。

| type               | 其他字段                               | 作用                                   |
| ------------------ | -------------------------------------- | -------------------------------------- |
| `xq:move`          | `from:0..89,to:0..89,matchId,revision` | 自己回合的合法走棋；不可自将、将帅照面 |
| `xq:draw`          | `matchId,revision`                     | 在无待处理请求时提出和棋               |
| `xq:draw-response` | `accept:boolean,matchId,revision`      | 仅对手可同意或拒绝当前请求             |

三个命令均校验席位、在线状态和精确对局版本；成功推进 revision，错误不改棋局。走棋自动撤销和棋请求。认输、离开、准备和翻转前端视角复用现有流程（翻转不发命令）。

match 还包含 history（含被吃棋子和将军标记）、positions（用于重复判定）、lastMove、quietPlies、drawOffer、status、winner、reason；winner 为 1/2/draw/null。全盘为公开信息，旁观者可读棋谱但不可操作。将死和困毙均判负；重复长将/其他重复和棋及 120 步未吃子采用 README 中声明的娱乐规则。棋谱仅在原进程内恢复，结果摘要持久化。

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { Accounts } from "../server/accounts.ts";
import { ChatStore } from "../server/chat.ts";
import { createHallServer } from "../server/app.ts";
import type { Command, ServerEvent, Snapshot } from "../shared/protocol.ts";
import type { ChatChannel } from "../shared/chat.ts";

class Client {
  snapshot: Snapshot | null = null;
  events: ServerEvent[] = [];
  listeners = new Set<(event: ServerEvent) => void>();
  constructor(public ws: WebSocket) {
    ws.on("message", (raw) => {
      const event = JSON.parse(raw.toString()) as ServerEvent;
      this.events.push(event);
      if (event.type === "snapshot") this.snapshot = event;
      for (const listener of this.listeners) listener(event);
    });
  }
  wait(predicate: (event: ServerEvent) => boolean): Promise<ServerEvent> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error("chat event timeout"));
      }, 3000);
      const listener = (event: ServerEvent) => {
        if (predicate(event)) {
          clearTimeout(timer);
          this.listeners.delete(listener);
          resolve(event);
        }
      };
      this.listeners.add(listener);
    });
  }
  async state(predicate: (snapshot: Snapshot) => boolean) {
    if (this.snapshot && predicate(this.snapshot)) return this.snapshot;
    return (await this.wait(
      (event) => event.type === "snapshot" && predicate(event),
    )) as Snapshot;
  }
  send(command: Command) {
    this.ws.send(JSON.stringify(command));
  }
  async chat(
    text: string,
    channel: ChatChannel = "hall",
    clientId = randomUUID(),
  ) {
    const result = this.wait(
      (event) =>
        (event.type === "chat:ack" || event.type === "chat:error") &&
        event.clientId === clientId,
    );
    this.send({ type: "chat", text, channel, clientId });
    return result;
  }
}
async function setup() {
  let now = Date.now();
  const app = createHallServer({ now: () => now });
  await new Promise<void>((resolve) =>
    app.server.listen(0, "127.0.0.1", resolve),
  );
  const origin = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  async function request(
    path: string,
    cookie = "",
    data?: unknown,
    source = origin,
  ) {
    return fetch(`${origin}/api/${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Cookie: cookie,
        Origin: source,
        "Content-Type": "application/json",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  }
  async function client(name: string) {
    const user = await app.accounts.create(name, "chat-test-password"),
      cookie = `hall_session=${app.accounts.session(user)}`;
    const client = new Client(
      new WebSocket(origin.replace("http", "ws") + "/ws", {
        headers: { Cookie: cookie, Origin: origin },
      }),
    );
    await client.state(() => true);
    return { user, cookie, client };
  }
  return {
    ...app,
    request,
    client,
    advance: () => {
      now += 900;
    },
  };
}

test("chat history persists across restart with stable pagination, retry deduplication and never-reused custom room ids", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "hall-chat-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "db.sqlite");
  let now = Date.now(),
    accounts = new Accounts(path),
    chat = new ChatStore(accounts.db, () => now);
  const user = await accounts.create("历史作者", "chat-test-password");
  const reader = await accounts.create("历史读者", "chat-test-password");
  chat.subscribe(user.id, "hall");
  chat.subscribe(reader.id, "hall");
  const firstClientId = randomUUID();
  const first = chat.send(user, "hall", firstClientId, "第一条").message;
  for (let i = 1; i < 123; i++) {
    now += 900;
    chat.send(user, "hall", randomUUID(), `记录 ${i}`);
  }
  now += 900;
  chat.send(user, "room:1001", randomUUID(), "房间独立记录");
  const custom = chat.allocateRoomId();
  chat.markRead(reader.id, "hall", first.seq + 72);
  accounts.db.close();
  accounts = new Accounts(path);
  t.after(() => accounts.db.close());
  chat = new ChatStore(accounts.db, () => now);
  chat.subscribe(reader.id, "hall");
  assert.equal(chat.page(reader.id, "hall").unread, 50);
  assert.equal(chat.send(user, "hall", firstClientId, "第一条").created, false);
  assert.equal(
    chat.send(user, "hall", firstClientId, "第一条").message.id,
    first.id,
  );
  assert.throws(
    () => chat.send(user, "hall", firstClientId, "不同原文"),
    /已被使用/,
  );
  const a = chat.page(user.id, "hall"),
    b = chat.page(user.id, "hall", a.messages[0].seq),
    c = chat.page(user.id, "hall", b.messages[0].seq);
  assert.deepEqual(
    [a.messages.length, b.messages.length, c.messages.length],
    [50, 50, 23],
  );
  assert.deepEqual([a.hasMore, b.hasMore, c.hasMore], [true, true, false]);
  const all = [...c.messages, ...b.messages, ...a.messages];
  assert.equal(new Set(all.map((m) => m.id)).size, 123);
  assert.ok(all.every((m, index) => index === 0 || m.seq > all[index - 1].seq));
  assert.ok(!all.some((m) => m.text === "房间独立记录"));
  assert.notEqual(chat.allocateRoomId(), custom);
});

test("room send, snapshots and history are restricted to current members, including watchers; leaving removes access", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const a = await app.client("房间作者"),
    b = await app.client("房间观战"),
    outsider = await app.client("大厅棋友");
  for (const actor of [a, b]) {
    actor.client.send({ type: "join", roomId: "1001" });
    await actor.client.state((s) => s.roomId === "1001");
  }
  const result = await a.client.chat("只在本桌显示", "room:1001");
  assert.equal(result.type, "chat:ack");
  await b.client.state(
    (s) =>
      s.chat.room?.messages.some((m) => m.text === "只在本桌显示") === true,
  );
  const outside = await outsider.client.state((s) =>
    s.players.some((p) => p.id === b.user.id && p.roomId === "1001"),
  );
  assert.equal(outside.chat.room, null);
  assert.ok(!JSON.stringify(outsider.client.events).includes("只在本桌显示"));
  assert.equal(
    (await outsider.client.chat("越权发言", "room:1001")).type,
    "chat:error",
  );
  assert.equal(
    (await app.request("chat/history?channel=room:1001", outsider.cookie))
      .status,
    403,
  );
  assert.equal(
    (await app.request("chat/history?channel=room:1001", b.cookie)).status,
    200,
  );
  b.client.send({ type: "leave" });
  await b.client.state((s) => !s.roomId);
  assert.equal(
    (await app.request("chat/history?channel=room:1001", b.cookie)).status,
    403,
  );
  app.advance();
  await a.client.chat("全大厅消息");
  await outsider.client.state((s) =>
    s.chat.hall.messages.some((m) => m.text === "全大厅消息"),
  );
  assert.equal((await app.request("chat/history?channel=hall")).status, 401);
  assert.equal(
    (await app.request("chat/history?channel=hall&before=-1", a.cookie)).status,
    400,
  );
  assert.equal(
    (
      await app.request(
        "chat/history?channel=hall",
        a.cookie,
        undefined,
        "https://attacker.example",
      )
    ).status,
    403,
  );
});

test("websocket acknowledgements follow durable writes, repeated ids return the same receipt, failed sends can be retried", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const a = await app.client("可靠发送");
  const id = randomUUID();
  const result = await a.client.chat("确认落库", "hall", id);
  assert.equal(result.type, "chat:ack");
  if (result.type !== "chat:ack") return;
  assert.equal(
    app.accounts.db
      .prepare("SELECT text FROM chat_messages WHERE id=?")
      .get(result.message.id)!.text,
    "确认落库",
  );
  const repeated = await a.client.chat("确认落库", "hall", id);
  assert.deepEqual(repeated, result);
  assert.equal(
    app.accounts.db.prepare("SELECT count(*) AS n FROM chat_messages").get()!.n,
    1,
  );
  const retryId = randomUUID();
  const rejected = await a.client.chat("稍后重试", "hall", retryId);
  assert.equal(rejected.type, "chat:error");
  app.advance();
  const retry = await a.client.chat("稍后重试", "hall", retryId);
  assert.equal(retry.type, "chat:ack");
  assert.equal(
    app.accounts.db.prepare("SELECT count(*) AS n FROM chat_messages").get()!.n,
    2,
  );
  assert.equal((await a.client.chat("x".repeat(201))).type, "chat:error");
});

test("unread cursors exclude own messages, remain monotonic, sync duplicate tabs and survive database reopen", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const a = await app.client("未读作者"),
    b = await app.client("未读读者");
  const first = await a.client.chat("未读一");
  assert.equal(first.type, "chat:ack");
  if (first.type !== "chat:ack") return;
  await b.client.state((s) => s.chat.hall.unread === 1);
  assert.equal(a.client.snapshot!.chat.hall.unread, 0);
  app.advance();
  const second = await a.client.chat("未读二");
  if (second.type !== "chat:ack") throw new Error("missing receipt");
  await b.client.state((s) => s.chat.hall.unread === 2);
  const mark = await app.request("chat/read", b.cookie, {
    channel: "hall",
    through: second.message.seq,
  });
  assert.equal(mark.status, 200);
  await b.client.state((s) => s.chat.hall.unread === 0);
  await app.request("chat/read", b.cookie, {
    channel: "hall",
    through: first.message.seq,
  });
  assert.equal(app.hall.chat.page(b.user.id, "hall").unread, 0);
  assert.equal(
    (
      await app.request("chat/read", b.cookie, {
        channel: "hall",
        through: 99999,
      })
    ).status,
    400,
  );
  const duplicate = new Client(
    new WebSocket(
      `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/ws`,
      { headers: { Cookie: b.cookie } },
    ),
  );
  await duplicate.state((s) => s.chat.hall.unread === 0);
  app.advance();
  await a.client.chat("未读三");
  await duplicate.state((s) => s.chat.hall.unread === 1);
  const latest = duplicate.snapshot!.chat.hall.messages.at(-1)!;
  await app.request("chat/read", b.cookie, {
    channel: "hall",
    through: latest.seq,
  });
  await duplicate.state((s) => s.chat.hall.unread === 0);
  // A fresh ChatStore over the same durable tables does not reset the read cursor.
  const reopened = new ChatStore(app.accounts.db);
  reopened.subscribe(b.user.id, "hall");
  assert.equal(reopened.unread(b.user.id, "hall"), 0);
});

test("deleting an account cascades persisted chat and read positions and changes the history revision", async (t) => {
  const accounts = new Accounts(":memory:");
  t.after(() => accounts.db.close());
  const chat = new ChatStore(accounts.db);
  const a = await accounts.create("注销聊天", "chat-test-password"),
    b = await accounts.create("其他聊天", "chat-test-password");
  chat.subscribe(a.id, "hall");
  chat.subscribe(b.id, "hall");
  chat.send(a, "hall", randomUUID(), "删除我的消息");
  chat.send(b, "hall", randomUUID(), "保留对方消息");
  const revision = chat.revision;
  await accounts.deleteAccount(a.id, "chat-test-password", a.name);
  assert.equal(chat.revision, revision + 1);
  assert.equal(chat.page(b.id, "hall").messages.length, 1);
  assert.equal(chat.page(b.id, "hall").messages[0].userId, b.id);
  assert.equal(
    accounts.db
      .prepare("SELECT count(*) AS n FROM chat_reads WHERE user_id=?")
      .get(a.id)!.n,
    0,
  );
});

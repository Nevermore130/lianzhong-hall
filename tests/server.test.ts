import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { createHallServer } from "../server/app.ts";
import type { Command, ServerEvent, Snapshot } from "../shared/protocol.ts";
import { Accounts } from "../server/accounts.ts";

class Client {
  snapshot: Snapshot | null = null;
  listeners = new Set<(event: ServerEvent) => void>();
  constructor(public ws: WebSocket) {
    ws.on("message", (raw) => {
      const data = JSON.parse(raw.toString()) as ServerEvent;
      if (data.type === "snapshot") this.snapshot = data;
      for (const listener of this.listeners) listener(data);
    });
  }
  event(predicate: (event: ServerEvent) => boolean): Promise<ServerEvent> {
    return new Promise((resolve, reject) => {
      const listener = (event: ServerEvent) => {
        if (predicate(event)) {
          clearTimeout(timer);
          this.listeners.delete(listener);
          resolve(event);
        }
      };
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error("等待服务器事件超时"));
      }, 4000);
      this.listeners.add(listener);
    });
  }
  async state(predicate: (state: Snapshot) => boolean): Promise<Snapshot> {
    if (this.snapshot && predicate(this.snapshot)) return this.snapshot;
    return (await this.event(
      (e) => e.type === "snapshot" && predicate(e),
    )) as Snapshot;
  }
  send(command: Command) {
    this.ws.send(JSON.stringify(command));
  }
  async error(command: unknown) {
    const promise = this.event((e) => e.type === "error");
    this.ws.send(JSON.stringify(command));
    const result = await promise;
    assert.equal(result.type, "error");
    return result;
  }
}
async function setup(disconnectMs = 60) {
  const app = createHallServer({ disconnectMs });
  await new Promise<void>((resolve) =>
    app.server.listen(0, "127.0.0.1", resolve),
  );
  const origin = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  async function request(
    path: string,
    data?: unknown,
    cookie = "",
    customOrigin = origin,
  ) {
    return fetch(`${origin}/api/${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: customOrigin,
        Cookie: cookie,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  }
  async function account(name: string) {
    const response = await request("register", {
      name,
      password: "test-password-123",
    });
    assert.equal(response.status, 200);
    return response.headers.getSetCookie()[0].split(";")[0];
  }
  async function connect(cookie: string) {
    const client = new Client(
      new WebSocket(origin.replace("http", "ws") + "/ws", {
        headers: { Cookie: cookie, Origin: origin },
      }),
    );
    await client.state(() => true);
    return client;
  }
  return { ...app, origin, request, account, connect };
}

test("two independent accounts complete a real websocket game; spectators and illegal moves rejected", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const black = await app.connect(await app.account("黑棋测试")),
    white = await app.connect(await app.account("白棋测试")),
    spectator = await app.connect(await app.account("观战测试"));
  for (const client of [black, white, spectator]) {
    client.send({ type: "join", roomId: "1001" });
    await client.state((s) => s.roomId === "1001");
  }
  black.send({ type: "sit", seat: 0 });
  await black.state((s) => s.rooms[0].seats[0]?.userId === s.me.id);
  await white.error({ type: "sit", seat: 0 });
  white.send({ type: "sit", seat: 1 });
  await white.state((s) => s.rooms[0].seats[1]?.userId === s.me.id);
  black.send({ type: "ready" });
  white.send({ type: "ready" });
  let state = await white.state((s) => s.rooms[0].match?.status === "playing");
  const matchId = state.rooms[0].match!.id;
  await white.error({ type: "move", index: 100, matchId });
  await spectator.error({ type: "move", index: 0, matchId });
  await black.error({ type: "move", index: -1, matchId });
  await black.error({ type: "join", roomId: "1002" });
  for (let i = 0; i < 5; i++) {
    black.send({ type: "move", index: i, matchId });
    state = await white.state(
      (s) => s.rooms[0].game === "gomoku" && s.rooms[0].match?.board[i] === 1,
    );
    if (i === 0) await white.error({ type: "move", index: i, matchId });
    if (i < 4) {
      const index = 30 + i * 2;
      white.send({ type: "move", index, matchId });
      await black.state(
        (s) =>
          s.rooms[0].game === "gomoku" && s.rooms[0].match?.board[index] === 2,
      );
    }
  }
  assert.equal(
    state.rooms[0].game === "gomoku" && state.rooms[0].match!.winner,
    1,
  );
  await black.state((s) => s.me.wins === 1);
  assert.equal(white.snapshot!.me.losses, 1);
  assert.equal(
    app.accounts.db.prepare("SELECT COUNT(*) AS count FROM results").get()!
      .count,
    1,
  );
  await spectator.state(
    (s) => s.rooms[0].game === "gomoku" && s.rooms[0].match?.winner === 1,
  );
  black.send({
    type: "chat",
    text: "这盘棋下得开心！",
    channel: "hall",
    clientId: randomUUID(),
  });
  await white.state((s) =>
    s.chat.hall.messages.some((m) => m.text === "这盘棋下得开心！"),
  );
  black.send({ type: "ready" });
  white.send({ type: "ready" });
  state = await black.state(
    (s) =>
      s.rooms[0].match?.status === "playing" && s.rooms[0].match.id !== matchId,
  );
  assert.equal(
    state.rooms[0].game === "gomoku" &&
      state.rooms[0].match!.board.filter(Boolean).length,
    0,
  );
  await black.error({ type: "move", index: 0, matchId });
  white.send({ type: "resign" });
  await black.state((s) => s.me.wins === 2);
});

test("refresh reconnect retains seat, duplicate tabs deduplicate presence, disconnect timeout awards loss", async (t) => {
  const app = await setup(180);
  t.after(() => app.close());
  const cookie = await app.account("重连棋友"),
    otherCookie = await app.account("等待棋友");
  const first = await app.connect(cookie),
    duplicate = await app.connect(cookie),
    opponent = await app.connect(otherCookie);
  await first.state((s) => s.players.length === 2);
  assert.equal(first.snapshot!.players.length, 2);
  first.send({ type: "join", roomId: "1002" });
  await first.state((s) => s.roomId === "1002");
  first.send({ type: "sit", seat: 0 });
  await first.state((s) => !!s.rooms[1].seats[0]);
  first.ws.close();
  await duplicate.state((s) => s.players.find((p) => p.id === s.me.id)!.online);
  const closed = new Promise((resolve) => duplicate.ws.once("close", resolve));
  duplicate.ws.close();
  await closed;
  const refreshed = await app.connect(cookie);
  assert.equal(refreshed.snapshot!.roomId, "1002");
  assert.equal(
    refreshed.snapshot!.rooms[1].seats[0]!.userId,
    refreshed.snapshot!.me.id,
  );
  opponent.send({ type: "join", roomId: "1002" });
  await opponent.state((s) => s.roomId === "1002");
  opponent.send({ type: "sit", seat: 1 });
  await opponent.state((s) => !!s.rooms[1].seats[1]);
  refreshed.send({ type: "ready" });
  opponent.send({ type: "ready" });
  await opponent.state((s) => s.rooms[1].match?.status === "playing");
  refreshed.ws.close();
  await opponent.state((s) => s.me.wins === 1);
  assert.equal(opponent.snapshot!.rooms[1].seats[0], null);
  assert.equal(app.accounts.get(refreshed.snapshot!.me.id)!.losses, 1);
});

test("API authentication, cookie flags, origin validation, logout invalidation, and bounded inputs", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const cookie = await app.account("身份测试");
  assert.equal((await app.request("me", undefined, cookie)).status, 200);
  assert.equal(
    (
      await app.request("register", {
        name: "身份测试",
        password: "other-password",
      })
    ).status,
    400,
  );
  assert.equal(
    (await app.request("login", { name: "身份测试", password: "incorrect" }))
      .status,
    400,
  );
  assert.equal(
    (await app.request("register", { name: "a", password: "1" })).status,
    400,
  );
  assert.equal((await app.request("register", { name: "漏密码" })).status, 400);
  assert.equal(
    (await app.request("guest", {}, "", "https://attacker.example")).status,
    403,
  );
  const auth = await app.request("login", {
    name: "身份测试",
    password: "test-password-123",
  });
  assert.match(auth.headers.getSetCookie()[0], /HttpOnly; SameSite=Strict/);
  const client = await app.connect(cookie);
  await client.error({ type: "create", name: "无效游戏", game: "unknown" });
  await client.error({ type: "chat", text: "x".repeat(201) });
  await client.error(null);
  const close = new Promise<number>((resolve) =>
    client.ws.once("close", resolve),
  );
  await app.request("logout", {}, cookie);
  assert.equal(await close, 4001);
  assert.equal(
    (await (await app.request("me", undefined, cookie)).json()).user,
    null,
  );
});

test("accounts, hashed passwords, and idempotent game results persist across store reopen", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "hall-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let store = new Accounts(join(directory, "db.sqlite"));
  const a = await store.create("持久化甲", "long-password"),
    b = await store.create("持久化乙", "long-password");
  const token = store.session(a);
  assert.notEqual(
    store.db.prepare("SELECT password FROM users WHERE id = ?").get(a.id)!
      .password,
    "long-password",
  );
  store.result("game-1", a.id, b.id, a.id, "五子连珠");
  store.result("game-1", a.id, b.id, a.id, "五子连珠");
  store.db.close();
  store = new Accounts(join(directory, "db.sqlite"));
  t.after(() => store.db.close());
  assert.equal((await store.login("持久化甲", "long-password")).wins, 1);
  assert.equal(store.get(b.id)!.losses, 1);
  assert.equal(store.resolve(token)!.id, a.id);
  store.db.prepare("UPDATE sessions SET expires = 0").run();
  assert.equal(store.resolve(token), null);
});

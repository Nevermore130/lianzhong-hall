import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import type {
  Command,
  ServerEvent,
  Snapshot,
  XiangqiRoom,
} from "../shared/protocol.ts";
import { createXiangqi, type XiangqiBoard } from "../shared/xiangqi.ts";
import { Accounts } from "../server/accounts.ts";
import { Hall } from "../server/hall.ts";
import { createHallServer } from "../server/app.ts";
const chess = (s: Snapshot) =>
  s.rooms.find((r): r is XiangqiRoom => r.game === "xiangqi")!;
class Peer {
  snapshot!: Snapshot;
  callbacks = new Set<(e: ServerEvent) => void>();
  constructor(readonly ws: WebSocket) {
    ws.on("message", (raw) => {
      const e = JSON.parse(raw.toString()) as ServerEvent;
      if (e.type === "snapshot") this.snapshot = e;
      for (const cb of this.callbacks) cb(e);
    });
  }
  event(predicate: (e: ServerEvent) => boolean): Promise<ServerEvent> {
    return new Promise((resolve, reject) => {
      const cb = (e: ServerEvent) => {
        if (predicate(e)) {
          clearTimeout(timer);
          this.callbacks.delete(cb);
          resolve(e);
        }
      };
      const timer = setTimeout(() => {
        this.callbacks.delete(cb);
        reject(new Error("象棋 WebSocket 状态超时"));
      }, 4000);
      this.callbacks.add(cb);
    });
  }
  async state(predicate: (s: Snapshot) => boolean): Promise<Snapshot> {
    if (this.snapshot && predicate(this.snapshot)) return this.snapshot;
    return (await this.event(
      (e) => e.type === "snapshot" && predicate(e),
    )) as Snapshot;
  }
  send(command: Command) {
    this.ws.send(JSON.stringify(command));
  }
  async error(command: unknown) {
    const pending = this.event((e) => e.type === "error");
    this.ws.send(JSON.stringify(command));
    return pending;
  }
}
async function setup(disconnectMs = 600) {
  const app = createHallServer({ disconnectMs });
  await new Promise<void>((resolve) =>
    app.server.listen(0, "127.0.0.1", resolve),
  );
  const origin = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  async function connect(cookie?: string) {
    if (!cookie) {
      const response = await fetch(origin + "/api/guest", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(response.status, 200);
      cookie = response.headers.getSetCookie()[0].split(";")[0];
    }
    const peer = new Peer(
      new WebSocket(origin.replace("http", "ws") + "/ws", {
        headers: { Origin: origin, Cookie: cookie },
      }),
    );
    await peer.state(() => true);
    return { peer, cookie };
  }
  return { ...app, connect };
}
async function start(app: Awaited<ReturnType<typeof setup>>) {
  const users = await Promise.all([
    app.connect(),
    app.connect(),
    app.connect(),
  ]);
  for (const { peer } of users) {
    peer.send({ type: "join", roomId: chess(peer.snapshot).id });
    await peer.state((s) => s.roomId === chess(s).id);
  }
  for (let i = 0; i < 2; i++) {
    users[i].peer.send({ type: "sit", seat: i as 0 | 1 });
    await users[i].peer.state((s) => chess(s).seats[i]?.userId === s.me.id);
  }
  users[0].peer.send({ type: "ready" });
  users[1].peer.send({ type: "ready" });
  await users[2].peer.state((s) => chess(s).match?.status === "playing");
  return users;
}
test("real WebSocket chess moves, spectators, stale actions, room chat and resignation results", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const [{ peer: red }, { peer: black }, { peer: watch }] = await start(app);
  let m = chess(watch.snapshot).match!;
  const first: Command = {
    type: "xq:move",
    from: 54,
    to: 45,
    matchId: m.id,
    revision: m.revision,
  };
  await watch.error(first);
  await black.error(first);
  await red.error({ ...first, to: 44 });
  await red.error({ type: "sit", seat: 2 });
  await red.error({ type: "move", index: 0, matchId: m.id });
  await red.error({ type: "join", roomId: "1001" });
  red.send(first);
  await watch.state((s) => chess(s).match?.revision === 1);
  assert.equal(chess(watch.snapshot).match!.board[45]?.side, 1);
  await red.error(first);
  await black.state((s) => chess(s).match?.revision === 1);
  m = chess(black.snapshot).match!;
  black.send({
    type: "xq:move",
    from: 27,
    to: 36,
    matchId: m.id,
    revision: m.revision,
  });
  await watch.state((s) => chess(s).match?.revision === 2);
  assert.equal(chess(watch.snapshot).match!.history.length, 2);
  const channel = `room:${chess(watch.snapshot).id}` as const;
  red.send({
    type: "chat",
    channel,
    text: "象棋房间聊天",
    clientId: randomUUID(),
  });
  await black.state(
    (s) =>
      s.chat.room?.messages.some((m) => m.text === "象棋房间聊天") === true,
  );
  assert.ok(
    !black.snapshot.chat.hall.messages.some((m) => m.text === "象棋房间聊天"),
  );
  black.send({ type: "resign" });
  await red.state(
    (s) => chess(s).match?.status === "finished" && s.me.wins === 1,
  );
  await watch.state((s) => chess(s).match?.winner === 1);
  assert.equal(app.accounts.get(black.snapshot.me.id)!.losses, 1);
  const row = app.accounts.db.prepare("SELECT * FROM results").get()!;
  assert.equal(row.game, "xiangqi");
  assert.equal(row.winner, red.snapshot.me.id);
  await black.error({ type: "resign" });
  assert.equal(app.accounts.get(red.snapshot.me.id)!.wins, 1);
  red.send({ type: "ready" });
  black.send({ type: "ready" });
  await watch.state(
    (s) => chess(s).match?.status === "playing" && chess(s).match?.id !== m.id,
  );
  assert.equal(chess(watch.snapshot).match!.history.length, 0);
});
test("draw offers need the opponent, reject stale acceptance, clear on moves and persist draws without a loss", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const [{ peer: red }, { peer: black }, { peer: watch }] = await start(app);
  const version = () => {
    const m = chess(watch.snapshot).match!;
    return { matchId: m.id, revision: m.revision };
  };
  red.send({ type: "xq:draw", ...version() });
  await watch.state((s) => chess(s).match?.drawOffer === 1);
  const stale = version();
  await red.error({ type: "xq:draw-response", accept: true, ...version() });
  await watch.error({ type: "xq:draw-response", accept: true, ...version() });
  black.send({ type: "xq:draw-response", accept: false, ...version() });
  await watch.state((s) => chess(s).match?.drawOffer === null);
  await black.error({ type: "xq:draw-response", accept: true, ...stale });
  red.send({ type: "xq:draw", ...version() });
  await watch.state((s) => chess(s).match?.drawOffer === 1);
  red.send({ type: "xq:move", from: 54, to: 45, ...version() });
  await watch.state(
    (s) => chess(s).match?.drawOffer === null && chess(s).match?.turn === 2,
  );
  black.send({ type: "xq:draw", ...version() });
  await watch.state((s) => chess(s).match?.drawOffer === 2);
  red.send({ type: "xq:draw-response", accept: true, ...version() });
  await watch.state((s) => chess(s).match?.winner === "draw");
  const row = app.accounts.db.prepare("SELECT * FROM results").get()!;
  assert.equal(row.winner, null);
  assert.equal(row.game, "xiangqi");
  for (const peer of [red, black]) {
    const user = app.accounts.get(peer.snapshot.me.id)!;
    assert.equal(user.wins + user.losses, 0);
  }
});
test("disconnect pauses chess; reconnect restores board and seat; timeout forfeits once", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const [{ peer: red }, black, { peer: watch }] = await start(app);
  const initial = chess(watch.snapshot).match!;
  black.peer.ws.close();
  await watch.state((s) =>
    s.players.some((p) => p.id === black.peer.snapshot.me.id && !p.online),
  );
  await red.error({
    type: "xq:move",
    from: 54,
    to: 45,
    matchId: initial.id,
    revision: 0,
  });
  const refreshed = await app.connect(black.cookie);
  assert.equal(refreshed.peer.snapshot.roomId, chess(watch.snapshot).id);
  assert.deepEqual(chess(refreshed.peer.snapshot).match?.board, initial.board);
  assert.equal(
    chess(refreshed.peer.snapshot).seats[1]?.userId,
    black.peer.snapshot.me.id,
  );
  refreshed.peer.ws.close();
  await watch.state((s) => chess(s).match?.status === "finished");
  assert.equal(chess(watch.snapshot).match?.winner, 1);
  assert.equal(chess(watch.snapshot).seats[1], null);
  assert.equal(app.accounts.get(red.snapshot.me.id)!.wins, 1);
  assert.equal(
    app.accounts.db.prepare("SELECT COUNT(*) AS n FROM results").get()!.n,
    1,
  );
});
test("a mating move through WebSocket produces the same terminal board for both players and observer", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const [{ peer: red }, { peer: black }, { peer: watch }] = await start(app);
  const room = app.hall.rooms.find(
    (r): r is XiangqiRoom => r.game === "xiangqi",
  )!;
  // Inject a legal mate-in-one fixture only into this isolated test server.
  const b: XiangqiBoard = Array(90).fill(null);
  for (const [i, side, kind] of [
    [85, 1, "king"],
    [4, 2, "king"],
    [22, 1, "rook"],
    [12, 1, "rook"],
    [16, 1, "horse"],
  ] as const)
    b[i] = { side, kind };
  room.match = createXiangqi("mate-fixture", b);
  red.send({
    type: "xq:move",
    from: 22,
    to: 13,
    matchId: "mate-fixture",
    revision: 0,
  });
  await watch.state((s) => chess(s).match?.winner === 1);
  await black.state((s) => chess(s).match?.winner === 1);
  await red.state((s) => s.me.wins === 1);
  assert.equal(chess(watch.snapshot).match?.reason, "将死");
  assert.deepEqual(
    chess(black.snapshot).match?.board,
    chess(red.snapshot).match?.board,
  );
  assert.equal(app.accounts.get(black.snapshot.me.id)!.losses, 1);
});
test("custom chess rooms, durable default IDs and game-tagged results survive account store reopen", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "xiangqi-store-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "hall.sqlite");
  let accounts = new Accounts(path);
  try {
    const red = await accounts.create("象棋红方", "test-password-123"),
      black = await accounts.create("象棋黑方", "test-password-123");
    const hall = new Hall(accounts),
      ids = hall.rooms.filter((r) => r.game === "xiangqi").map((r) => r.id);
    assert.equal(ids.length, 6);
    hall.connect(red);
    hall.dispatch(red.id, {
      type: "create",
      game: "xiangqi",
      name: "楚河棋友桌",
    });
    const custom = hall.room(red.id);
    assert.equal(custom.game, "xiangqi");
    assert.equal(custom.seats.length, 2);
    assert.ok(hall.snapshot(red).chat.room);
    accounts.result("durable-xq", red.id, black.id, red.id, "将死", "xiangqi");
    accounts.result("durable-xq", red.id, black.id, red.id, "将死", "xiangqi");
    accounts.result("legacy-gomoku", black.id, red.id, null, "棋盘已满");
    accounts.db.close();
    accounts = new Accounts(path);
    assert.deepEqual(
      new Hall(accounts).rooms
        .filter((r) => r.game === "xiangqi")
        .map((r) => r.id),
      ids,
    );
    assert.equal(accounts.get(red.id)!.wins, 1);
    assert.equal(accounts.get(black.id)!.losses, 1);
    assert.equal(
      accounts.db
        .prepare("SELECT game FROM results WHERE id=?")
        .get("durable-xq")!.game,
      "xiangqi",
    );
    assert.equal(
      accounts.db
        .prepare("SELECT game FROM results WHERE id=?")
        .get("legacy-gomoku")!.game,
      "gomoku",
    );
  } finally {
    accounts.db.close();
  }
});

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
  MahjongRoom,
} from "../shared/protocol.ts";
import {
  mahjongComputerAction,
  mahjongView,
  advanceMahjong,
  type MahjongAction,
  type MahjongSeat,
  type MahjongState,
} from "../shared/mahjong.ts";
import { Accounts } from "../server/accounts.ts";
import { Hall } from "../server/hall.ts";
import { createHallServer } from "../server/app.ts";
import { fixture, readyHand } from "./mahjong-fixtures.ts";
const mahjong = (s: Snapshot) =>
  s.rooms.find((r): r is MahjongRoom => r.game === "mahjong")!;
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
        reject(new Error("麻将 WebSocket 状态超时"));
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
    app.connect(),
    app.connect(),
  ]);
  for (const { peer } of users) {
    peer.send({ type: "join", roomId: mahjong(peer.snapshot).id });
    await peer.state((s) => s.roomId === mahjong(s).id);
  }
  for (let i = 0; i < 4; i++) {
    users[i].peer.send({ type: "sit", seat: i as MahjongSeat });
    await users[i].peer.state((s) => mahjong(s).seats[i]?.userId === s.me.id);
  }
  for (let i = 0; i < 4; i++) users[i].peer.send({ type: "ready" });
  await users[4].peer.state((s) => mahjong(s).match?.status === "playing");
  return users;
}
function command(s: Snapshot, action: MahjongAction): Command {
  const m = mahjong(s).match!;
  return { type: "mj:action", matchId: m.id, revision: m.revision, action };
}
test("five real WebSocket clients: private dealing, legal moves, stale/illegal commands, isolated chat and complete settlement", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const users = await start(app);
  const peers = users.map((u) => u.peer),
    watch = peers[4];
  const m = mahjong(watch.snapshot).match!;
  for (let seat = 0; seat < 4; seat++) {
    await peers[seat].state((s) => mahjong(s).match?.id === m.id);
    const v = mahjong(peers[seat].snapshot).match!;
    assert.equal(v.hand.length, seat === 0 ? 14 : 13);
    assert.equal(v.remaining, 83);
    assert.equal(v.revealed, null);
    assert.ok(!("wall" in v));
    assert.ok(!("hands" in v));
  }
  assert.equal(m.hand.length, 0);
  assert.equal(m.drawn, null);
  assert.deepEqual(m.options, []);
  const east = peers[0],
    first = command(east.snapshot, {
      type: "discard",
      tile: mahjong(east.snapshot).match!.hand[0],
    });
  await watch.error(first);
  await peers[1].error(first);
  await east.error({ ...first, action: { type: "discard", tile: 999 } });
  await east.error({ ...first, action: null });
  await east.error({ ...first, action: { type: "unknown" } });
  await east.error({ type: "sit", seat: 4 });
  await east.error({ type: "ddz:pass", matchId: m.id, revision: 0 });
  east.send(first);
  await watch.state((s) => mahjong(s).match!.revision > 0);
  await east.error(first);
  east.send({
    type: "chat",
    channel: `room:${mahjong(east.snapshot).id}`,
    text: "麻将桌测试",
    clientId: randomUUID(),
  });
  await peers[3].state(
    (s) => s.chat.room?.messages.some((m) => m.text === "麻将桌测试") === true,
  );
  assert.ok(
    !peers[3].snapshot.chat.hall.messages.some((m) => m.text === "麻将桌测试"),
  );
  // Drive only each player's personalized view; no engine state or wall is used by the clients.
  for (
    let step = 0;
    step < 450 && mahjong(watch.snapshot).match!.status === "playing";
    step++
  ) {
    const revision = mahjong(watch.snapshot).match!.revision;
    await Promise.all(
      peers
        .slice(0, 4)
        .map((p) => p.state((s) => mahjong(s).match!.revision >= revision)),
    );
    const seat = ([0, 1, 2, 3] as const).find((i) =>
      mahjongComputerAction(mahjong(peers[i].snapshot).match!, i),
    );
    assert.notEqual(seat, undefined);
    const p = peers[seat!],
      v = mahjong(p.snapshot).match!;
    p.send(command(p.snapshot, mahjongComputerAction(v, seat!)!));
    await watch.state((s) => mahjong(s).match!.revision > revision);
  }
  const finished = mahjong(watch.snapshot).match!;
  assert.equal(finished.status, "finished");
  assert.equal(
    finished.scores.reduce((a, b) => a + b, 0),
    0,
  );
  assert.ok(finished.revealed);
  const row = app.accounts.db.prepare("SELECT * FROM mahjong_results").get()!;
  assert.equal(row.id, finished.id);
  assert.equal(row.kind, finished.result!.kind);
  const rows = app.accounts.db
    .prepare("SELECT * FROM mahjong_result_players ORDER BY seat")
    .all();
  assert.equal(rows.length, 4);
  rows.forEach((r, seat) => {
    const user = app.accounts.get(peers[seat].snapshot.me.id)!;
    assert.equal(r.score, finished.scores[seat]);
    assert.equal(user.wins, r.outcome === "win" ? 1 : 0);
    assert.equal(user.losses, r.outcome === "loss" ? 1 : 0);
  });
  await east.error({ type: "resign" });
  assert.equal(
    app.accounts.db.prepare("SELECT COUNT(*) n FROM mahjong_results").get()!.n,
    1,
  );
  for (const p of peers.slice(0, 4)) p.send({ type: "ready" });
  await watch.state(
    (s) =>
      mahjong(s).match?.status === "playing" &&
      mahjong(s).match?.id !== finished.id,
  );
});
test("simultaneous responses to one discard resolve by priority, old claim revisions cannot act on later turns", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const users = await start(app),
    watch = users[4].peer;
  const room = app.hall.rooms.find(
    (r): r is MahjongRoom<MahjongState> => r.game === "mahjong",
  )!;
  const s = fixture([[2], [0, 1], [2, 2], [0, 1]]);
  room.match = advanceMahjong(s, 0, { type: "discard", tile: s.hands[0][0] });
  const v = room.match.revision;
  const chi = mahjongView(room.match, 1).options[0],
    peng = mahjongView(room.match, 2).options.find((o) => o.choice === "peng")!;
  users[1].peer.send({
    type: "mj:action",
    matchId: s.id,
    revision: v,
    action: { type: "claim", ...chi },
  });
  users[2].peer.send({
    type: "mj:action",
    matchId: s.id,
    revision: v,
    action: { type: "claim", ...peng },
  });
  await watch.state(
    (s) =>
      mahjong(s).match?.id === "fixture" &&
      mahjong(s).match?.phase === "discard",
  );
  assert.equal(room.match.melds[2][0].kind, "peng");
  assert.equal(room.match.turn, 2);
  await users[1].peer.error({
    type: "mj:action",
    matchId: s.id,
    revision: v,
    action: { type: "claim", ...chi },
  });
});
test("disconnect freezes actions; same session reconnect preserves hand; timeout only penalizes leaver once", async (t) => {
  const app = await setup(700);
  t.after(() => app.close());
  const users = await start(app),
    watch = users[4].peer,
    east = users[0].peer;
  await users[2].peer.state((s) => mahjong(s).match?.status === "playing");
  const before = mahjong(users[2].peer.snapshot).match!;
  users[2].peer.ws.close();
  await watch.state((s) =>
    s.players.some((p) => p.id === users[2].peer.snapshot.me.id && !p.online),
  );
  await east.error(
    command(east.snapshot, {
      type: "discard",
      tile: mahjong(east.snapshot).match!.hand[0],
    }),
  );
  const reconnected = await app.connect(users[2].cookie);
  assert.deepEqual(mahjong(reconnected.peer.snapshot).match!.hand, before.hand);
  assert.equal(
    mahjong(reconnected.peer.snapshot).seats[2]?.userId,
    users[2].peer.snapshot.me.id,
  );
  reconnected.peer.ws.close();
  await watch.state((s) => mahjong(s).match?.status === "finished");
  const m = mahjong(watch.snapshot).match!;
  assert.equal(m.result?.kind, "forfeit");
  assert.equal(m.result?.winner, null);
  assert.deepEqual(m.scores, [0, 0, 0, 0]);
  for (let seat = 0; seat < 4; seat++) {
    const u = app.accounts.get(users[seat].peer.snapshot.me.id)!;
    assert.equal(u.wins, 0);
    assert.equal(u.losses, seat === 2 ? 1 : 0);
  }
  assert.equal(
    app.accounts.db.prepare("SELECT COUNT(*) n FROM mahjong_results").get()!.n,
    1,
  );
});
test("winning hand through WebSocket persists one winner and correct three self-draw losses", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const users = await start(app);
  const room = app.hall.rooms.find(
    (r): r is MahjongRoom<MahjongState> => r.game === "mahjong",
  )!;
  room.match = fixture([[...readyHand, 31], [], [], []]);
  users[0].peer.send({
    type: "mj:action",
    matchId: "fixture",
    revision: 0,
    action: { type: "hu" },
  });
  await users[4].peer.state(
    (s) => mahjong(s).match?.result?.kind === "self-draw",
  );
  assert.deepEqual(
    mahjong(users[4].peer.snapshot).match?.scores,
    [3, -1, -1, -1],
  );
  for (let i = 0; i < 4; i++) {
    const u = app.accounts.get(users[i].peer.snapshot.me.id)!;
    assert.equal(u.wins, i === 0 ? 1 : 0);
    assert.equal(u.losses, i === 0 ? 0 : 1);
  }
});
test("default room IDs and idempotent Mahjong results survive reopening SQLite; custom rooms support fourth seat", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mahjong-store-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "hall.sqlite");
  let accounts = new Accounts(path);
  try {
    const users = await Promise.all(
      [0, 1, 2, 3].map((i) =>
        accounts.create(`麻将测试${i}`, "test-password-123"),
      ),
    );
    const hall = new Hall(accounts),
      ids = hall.rooms.filter((r) => r.game === "mahjong").map((r) => r.id);
    assert.equal(ids.length, 6);
    hall.connect(users[0]);
    hall.dispatch(users[0].id, {
      type: "create",
      game: "mahjong",
      name: "四方牌友",
    });
    assert.equal(hall.room(users[0].id).seats.length, 4);
    hall.dispatch(users[0].id, { type: "sit", seat: 3 });
    assert.equal(hall.room(users[0].id).seats[3]?.userId, users[0].id);
    const scores = [-1, 1, 0, 0],
      result = {
        kind: "discard" as const,
        winner: 1 as const,
        loser: 0 as const,
        reason: "南位点炮胡",
      };
    const results = users.map((u, i) => ({
      userId: u.id,
      won: i === 1,
      lost: i === 0,
      score: scores[i],
    }));
    accounts.mahjongResult("persisted", results, result);
    accounts.mahjongResult("persisted", results, result);
    accounts.db.close();
    accounts = new Accounts(path);
    assert.equal(accounts.get(users[1].id)!.wins, 1);
    assert.equal(accounts.get(users[0].id)!.losses, 1);
    assert.equal(accounts.get(users[2].id)!.losses, 0);
    assert.deepEqual(
      new Hall(accounts).rooms
        .filter((r) => r.game === "mahjong")
        .map((r) => r.id),
      ids,
    );
    assert.equal(
      accounts.db
        .prepare("SELECT COUNT(*) n FROM mahjong_result_players")
        .get()!.n,
      4,
    );
    // No user identifier remains on the Mahjong result when the user row is deleted.
    accounts.db.prepare("DELETE FROM users WHERE id=?").run(users[3].id);
    assert.equal(
      accounts.db
        .prepare("SELECT user_id FROM mahjong_result_players WHERE seat=3")
        .get()!.user_id,
      null,
    );
  } finally {
    accounts.db.close();
  }
});

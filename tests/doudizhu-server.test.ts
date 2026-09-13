import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import { createHallServer } from "../server/app.ts";
import type {
  Command,
  DoudizhuRoom,
  Snapshot,
  ServerEvent,
} from "../shared/protocol.ts";
import { computerAction } from "../shared/doudizhu.ts";
import { Accounts } from "../server/accounts.ts";
import { Hall } from "../server/hall.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ddz = (s: Snapshot) =>
  s.rooms.find((r): r is DoudizhuRoom => r.game === "doudizhu")!;
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
  wait(predicate: (e: ServerEvent) => boolean): Promise<ServerEvent> {
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
        reject(new Error("WebSocket 状态超时"));
      }, 4000);
      this.callbacks.add(cb);
    });
  }
  async state(predicate: (s: Snapshot) => boolean): Promise<Snapshot> {
    if (this.snapshot && predicate(this.snapshot)) return this.snapshot;
    return (await this.wait(
      (e) => e.type === "snapshot" && predicate(e),
    )) as Snapshot;
  }
  send(c: Command) {
    this.ws.send(JSON.stringify(c));
  }
  async error(c: unknown) {
    const wait = this.wait((e) => e.type === "error");
    this.ws.send(JSON.stringify(c));
    return await wait;
  }
}
async function setup(disconnectMs = 500) {
  const app = createHallServer({ disconnectMs });
  await new Promise<void>((resolve) =>
    app.server.listen(0, "127.0.0.1", resolve),
  );
  const origin =
    "http://127.0.0.1:" + (app.server.address() as AddressInfo).port;
  async function connect(cookie?: string) {
    if (!cookie) {
      const r = await fetch(origin + "/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: "{}",
      });
      cookie = r.headers.getSetCookie()[0].split(";")[0];
    }
    const peer = new Peer(
      new WebSocket(origin.replace("http", "ws") + "/ws", {
        headers: { Cookie: cookie, Origin: origin },
      }),
    );
    await peer.state(() => true);
    return { peer, cookie };
  }
  return { ...app, connect };
}
async function start(app: Awaited<ReturnType<typeof setup>>) {
  const clients = await Promise.all([
    app.connect(),
    app.connect(),
    app.connect(),
    app.connect(),
  ]);
  for (const { peer } of clients) {
    peer.send({ type: "join", roomId: ddz(peer.snapshot).id });
    await peer.state((s) => s.roomId === ddz(s).id);
  }
  for (let i = 0; i < 3; i++) {
    const peer = clients[i].peer;
    peer.send({ type: "sit", seat: i as 0 | 1 | 2 });
    await peer.state((s) => ddz(s).seats[i]?.userId === s.me.id);
  }
  for (let i = 0; i < 3; i++) clients[i].peer.send({ type: "ready" });
  await clients[3].peer.state((s) => ddz(s).match?.phase === "bidding");
  return clients;
}
test("three real WebSocket players complete a card game with private hands, stale command protection and atomic team results", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const clients = await start(app),
    observer = clients[3].peer;
  const room = ddz(observer.snapshot),
    initial = room.match!;
  assert.equal(initial.hand.length, 0);
  assert.deepEqual(initial.bottom, []);
  assert.ok(!JSON.stringify(observer.snapshot).includes('"hands":'));
  const handIds: number[] = [];
  for (let i = 0; i < 3; i++) {
    const s = await clients[i].peer.state(
      (s) => ddz(s).match?.id === initial.id,
    );
    const hand = ddz(s).match!.hand;
    assert.equal(hand.length, 17);
    handIds.push(...hand);
  }
  assert.equal(new Set(handIds).size, 51);
  await observer.error({
    type: "ddz:bid",
    score: 3,
    matchId: initial.id,
    revision: 0,
  });
  const caller = clients[initial.turn].peer;
  const bid: Command = {
    type: "ddz:bid",
    score: 3,
    matchId: initial.id,
    revision: 0,
  };
  caller.send(bid);
  await observer.state((s) => ddz(s).match?.phase === "playing");
  await caller.error(bid);
  const landlord = ddz(observer.snapshot).match!.landlord!;
  const refreshed = await app.connect(clients[landlord].cookie);
  assert.equal(refreshed.peer.snapshot.roomId, room.id);
  assert.equal(ddz(refreshed.peer.snapshot).match!.hand.length, 20);
  refreshed.peer.ws.close();
  const targetRevision = ddz(observer.snapshot).match!.revision;
  const other = await clients[(landlord + 1) % 3].peer.state(
    (s) => (ddz(s).match?.revision ?? -1) >= targetRevision,
  );
  const foreign = ddz(other).match!.hand[0];
  await caller.error({
    type: "ddz:play",
    cards: [foreign],
    matchId: initial.id,
    revision: targetRevision,
  });
  await caller.error({ type: "join", roomId: "1001" });
  for (let steps = 0; steps < 400; steps++) {
    const state = ddz(observer.snapshot).match!;
    if (state.status === "finished") break;
    const current = clients[state.turn].peer;
    const snapshot = await current.state(
      (s) => (ddz(s).match?.revision ?? -1) >= state.revision,
    );
    const view = ddz(snapshot).match!,
      action = computerAction(view, state.turn);
    const version = { matchId: view.id, revision: view.revision };
    current.send(
      action.type === "play"
        ? { type: "ddz:play", cards: action.cards, ...version }
        : { type: "ddz:pass", ...version },
    );
    await observer.state((s) => ddz(s).match!.revision > view.revision);
  }
  const done = ddz(observer.snapshot).match!;
  assert.equal(done.status, "finished");
  assert.equal(
    done.scores.reduce((a, b) => a + b, 0),
    0,
  );
  assert.deepEqual(done.hand, []);
  assert.equal(
    app.accounts.db.prepare("SELECT COUNT(*) AS n FROM card_results").get()!.n,
    1,
  );
  const rows = app.accounts.db
    .prepare("SELECT * FROM card_result_players")
    .all();
  assert.equal(rows.length, 3);
  for (let i = 0; i < 3; i++) {
    const won =
      done.winner === "landlord" ? i === done.landlord : i !== done.landlord;
    const user = app.accounts.get(clients[i].peer.snapshot.me.id)!;
    assert.equal(user.wins, won ? 1 : 0);
    assert.equal(user.losses, won ? 0 : 1);
  }
  await caller.error({
    type: "ddz:play",
    cards: [0],
    matchId: done.id,
    revision: done.revision,
  });
  for (let i = 0; i < 3; i++) clients[i].peer.send({ type: "ready" });
  await observer.state(
    (s) => ddz(s).match?.id !== done.id && ddz(s).match?.phase === "bidding",
  );
  assert.equal(ddz(observer.snapshot).match!.hand.length, 0);
});
test("disconnect pauses play, reconnection restores only own hand, farmer timeout loses as a team", async (t) => {
  const app = await setup(160);
  t.after(() => app.close());
  const clients = await start(app),
    observer = clients[3].peer;
  const state = ddz(observer.snapshot).match!;
  clients[state.turn].peer.send({
    type: "ddz:bid",
    score: 3,
    matchId: state.id,
    revision: state.revision,
  });
  await observer.state((s) => ddz(s).match?.phase === "playing");
  const view = ddz(observer.snapshot).match!,
    landlord = view.landlord!,
    farmer = (landlord + 1) % 3;
  clients[farmer].peer.ws.close();
  await observer.state(
    (s) =>
      !s.players.find((p) => p.id === clients[farmer].peer.snapshot.me.id)!
        .online,
  );
  const current = clients[landlord].peer;
  const s = await current.state((s) => ddz(s).match?.phase === "playing");
  const mine = ddz(s).match!;
  await current.error({
    type: "ddz:play",
    cards: [mine.hand[0]],
    matchId: mine.id,
    revision: mine.revision,
  });
  await observer.state((s) => ddz(s).match?.status === "finished");
  assert.equal(ddz(observer.snapshot).match!.winner, "landlord");
  for (let i = 0; i < 3; i++)
    assert.equal(
      app.accounts.get(clients[i].peer.snapshot.me.id)![
        i === landlord ? "wins" : "losses"
      ],
      1,
    );
});
test("bidding cancellation has no wins or losses and does not reveal the hidden bottom cards", async (t) => {
  const app = await setup();
  t.after(() => app.close());
  const clients = await start(app),
    observer = clients[3].peer,
    state = ddz(observer.snapshot).match!;
  clients[state.turn].peer.send({
    type: "ddz:bid",
    score: 1,
    matchId: state.id,
    revision: 0,
  });
  await observer.state((s) => ddz(s).match!.revision === 1);
  assert.deepEqual(ddz(observer.snapshot).match!.bottom, []);
  clients[(state.turn + 1) % 3].peer.send({ type: "leave" });
  await observer.state((s) => ddz(s).match?.status === "finished");
  assert.equal(ddz(observer.snapshot).match!.winner, null);
  assert.deepEqual(ddz(observer.snapshot).match!.bottom, []);
  for (const { peer } of clients.slice(0, 3)) {
    const user = app.accounts.get(peer.snapshot.me.id)!;
    assert.equal(user.wins + user.losses, 0);
  }
});
test("card results and default room identities survive restart; deletion anonymizes only the deleted player", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "ddz-store-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const path = join(folder, "hall.sqlite");
  let accounts = new Accounts(path),
    hall = new Hall(accounts);
  const ids = hall.rooms.filter((r) => r.game === "doudizhu").map((r) => r.id);
  const users = await Promise.all(
    ["牌手甲", "牌手乙", "牌手丙"].map((name) =>
      accounts.create(name, "test-password"),
    ),
  );
  const people = users.map((u, i) => ({
    userId: u.id,
    role: i === 0 ? ("landlord" as const) : ("farmer" as const),
    won: i !== 0,
    score: i === 0 ? -4 : 2,
  }));
  accounts.cardResult("persist", people, "farmers", "手牌出完", 2, 1, false);
  accounts.cardResult("persist", people, "farmers", "手牌出完", 2, 1, false);
  accounts.db.close();
  accounts = new Accounts(path);
  hall = new Hall(accounts);
  t.after(() => accounts.db.close());
  assert.deepEqual(
    hall.rooms.filter((r) => r.game === "doudizhu").map((r) => r.id),
    ids,
  );
  assert.equal(accounts.get(users[0].id)!.losses, 1);
  assert.equal(accounts.get(users[1].id)!.wins, 1);
  await accounts.deleteAccount(users[0].id, "test-password", users[0].name);
  assert.equal(
    accounts.db
      .prepare(
        "SELECT user_id FROM card_result_players WHERE match_id='persist' AND seat=0",
      )
      .get()!.user_id,
    null,
  );
  assert.equal(accounts.get(users[1].id)!.wins, 1);
  assert.ok(!ids.includes(hall.chat.allocateRoomId()));
});

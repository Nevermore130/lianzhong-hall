import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Accounts,
  SESSION_IDLE_MS,
  SESSION_MAX_MS,
} from "../server/accounts.ts";

const password = "test-password-123";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function fixture(t: TestContext) {
  let time = Date.now();
  const store = new Accounts(":memory:", () => time);
  t.after(() => store.db.close());
  return {
    store,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

test("legacy database migration preserves guest stats, hashed credentials and live sessions; migration is idempotent", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "hall-migration-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "old.sqlite"),
    token = "legacy-test-token",
    now = Date.now();
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT UNIQUE COLLATE NOCASE,guest INTEGER,password TEXT,wins INTEGER,losses INTEGER);
    CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER);
    CREATE TABLE results(id TEXT PRIMARY KEY,black_id TEXT,white_id TEXT,winner TEXT,reason TEXT,ended INTEGER);
    INSERT INTO users VALUES('guest-old','原有游客',1,NULL,5,2);`);
  old
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(hash(token), "guest-old", now + 86400_000);
  old.close();
  let store = new Accounts(path, () => now);
  const first = store.sessions("guest-old", token)[0];
  assert.equal(store.resolve(token)!.wins, 5);
  assert.equal(store.get("guest-old")!.avatar, 0);
  assert.equal(first.current, true);
  store.db.close();
  store = new Accounts(path, () => now);
  t.after(() => store.db.close());
  assert.deepEqual(store.sessions("guest-old", token)[0], first);
  const member = await store.upgrade("guest-old", "原游客转正", password);
  assert.equal(member.id, "guest-old");
  assert.equal(member.wins, 5);
  assert.equal(member.losses, 2);
  assert.equal(store.resolve(token), null);
  assert.equal((await store.login("原游客转正", password)).id, member.id);
});

test("guest upgrade rolls back name collisions and permits only one concurrent upgrade", async (t) => {
  const { store } = fixture(t);
  const guest = await store.create(null);
  const token = store.session(guest);
  await store.create("已用昵称", password);
  await assert.rejects(
    store.upgrade(guest.id, "已用昵称", password),
    /昵称已被使用/,
  );
  assert.equal(store.resolve(token)!.guest, true);
  const outcomes = await Promise.allSettled([
    store.upgrade(guest.id, "转正甲", password),
    store.upgrade(guest.id, "转正乙", password),
  ]);
  assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(store.resolve(token), null);
});

test("sessions renew within idle and absolute limits, reveal no secret, and cannot revoke another account", async (t) => {
  const { store, advance } = fixture(t);
  const user = await store.create("会话甲", password),
    other = await store.create("会话乙", password);
  const token = store.session(user, "Mozilla Windows Chrome/100"),
    second = store.session(user, "iPhone Safari/123"),
    foreign = store.session(other);
  const list = store.sessions(user.id, token);
  assert.equal(list.length, 2);
  assert.equal(list.filter((s) => s.current).length, 1);
  assert.equal(list[0].device, "Chrome · Windows");
  assert.ok(!JSON.stringify(list).includes(token));
  assert.ok(!JSON.stringify(list).includes(hash(token)));
  assert.throws(
    () =>
      store.revokeDevice(
        user.id,
        store.sessions(other.id, foreign)[0].id,
        token,
      ),
    /已退出/,
  );
  assert.throws(
    () => store.revokeDevice(user.id, list.find((s) => s.current)!.id, token),
    /当前设备/,
  );
  store.revokeDevice(user.id, list.find((s) => !s.current)!.id, token);
  assert.equal(store.resolve(second), null);
  assert.ok(store.resolve(foreign));
  for (let day = 6; day <= 24; day += 6) {
    advance(6 * 86400_000);
    assert.equal(store.renew(token).maxAge, Math.min(7, 30 - day) * 86400);
  }
  advance(5 * 86400_000);
  assert.equal(store.renew(token).maxAge, 86400);
  advance(86400_000);
  assert.equal(store.resolve(token), null);
  assert.throws(() => store.renew(token), /登录已失效/);
  const idle = store.session(user);
  advance(SESSION_IDLE_MS);
  assert.throws(() => store.renew(idle), /登录已失效/);
  assert.equal(SESSION_MAX_MS, 30 * 86400_000);
});

test("five failures lock one account across nickname/email aliases and concurrent attempts, with persisted lock and expiry", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "hall-lock-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let now = Date.now();
  const path = join(directory, "lock.sqlite");
  let store = new Accounts(path, () => now);
  const user = await store.create("LockUser", password);
  const email = await store.prepareEmail(user.id, "Lock@Example.com", password);
  store.confirmEmail(email.token);
  const outcomes = await Promise.allSettled(
    Array.from({ length: 6 }, (_, index) =>
      store.login(
        index % 2 ? "LOCK@example.com" : "ｌｏｃｋｕｓｅｒ",
        "incorrect",
      ),
    ),
  );
  assert.equal(
    outcomes.filter((r) => r.status === "rejected" && r.reason.status === 429)
      .length,
    1,
  );
  store.db.close();
  store = new Accounts(path, () => now);
  t.after(() => store.db.close());
  await assert.rejects(store.login("LockUser", password), {
    status: 429,
    retryAfter: 900,
  });
  now += 15 * 60_000;
  assert.equal((await store.login("lock@example.com", password)).id, user.id);
});

test("email verification and password reset are private, purpose-scoped, expiring, single-use and invalidate sessions", async (t) => {
  const { store, advance } = fixture(t);
  const user = await store.create("邮箱测试", password),
    session = store.session(user);
  await assert.rejects(
    store.prepareEmail(user.id, "test@example.com", "incorrect"),
  );
  const verification = await store.prepareEmail(
    user.id,
    " TEST@example.com ",
    password,
  );
  assert.equal(store.profile(user.id).email, null);
  assert.equal(store.prepareReset("test@example.com"), null);
  assert.equal(
    store.db.prepare("SELECT token FROM verifications").get()!.token,
    hash(verification.token),
  );
  await assert.rejects(
    store.resetPassword(verification.token, "new-password"),
    /链接无效/,
  );
  await assert.rejects(
    store.prepareEmail(user.id, "next@example.com", password),
    { status: 429 },
  );
  advance(61_000);
  const replacement = await store.prepareEmail(
    user.id,
    "test@example.com",
    password,
  );
  assert.throws(() => store.confirmEmail(verification.token), /链接无效/);
  store.confirmEmail(replacement.token);
  assert.throws(() => store.confirmEmail(replacement.token), /链接无效/);
  assert.equal(store.profile(user.id).email, "test@example.com");
  assert.equal(store.resolve(session), null);
  const login = await store.login("TEST@example.com", password);
  assert.ok(!("email" in login));
  const newSession = store.session(login);
  const reset = store.prepareReset("test@example.com")!;
  assert.equal(store.prepareReset("test@example.com"), null);
  assert.throws(() => store.confirmEmail(reset.token), /链接无效/);
  const resetOutcomes = await Promise.allSettled([
    store.resetPassword(reset.token, "changed-password"),
    store.resetPassword(reset.token, "changed-password"),
  ]);
  assert.equal(resetOutcomes.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(store.resolve(newSession), null);
  await assert.rejects(store.login("邮箱测试", password));
  assert.equal(
    (await store.login("test@example.com", "changed-password")).id,
    user.id,
  );
  const expired = store.prepareReset("test@example.com")!;
  advance(15 * 60_000);
  await assert.rejects(
    store.resetPassword(expired.token, "another-password"),
    /链接无效/,
  );
});

test("password change rejects stale authorization, cancels old recovery links, and unlocks via a valid reset", async (t) => {
  const { store } = fixture(t);
  const user = await store.create("密码测试", password),
    token = store.session(user);
  const bind = await store.prepareEmail(
    user.id,
    "password@example.com",
    password,
  );
  store.confirmEmail(bind.token);
  const reset = store.prepareReset("password@example.com")!;
  await assert.rejects(
    store.changePassword(user.id, password, "new-password", () => {
      throw new Error("revoked");
    }),
    /revoked/,
  );
  assert.equal((await store.login(user.name, password)).id, user.id);
  await store.changePassword(user.id, password, "new-password");
  assert.equal(store.resolve(token), null);
  await assert.rejects(store.resetPassword(reset.token, password), /链接无效/);
  for (let i = 0; i < 5; i++)
    await assert.rejects(store.login(user.name, "wrong"));
  await assert.rejects(store.login(user.name, "new-password"), { status: 429 });
  const unlock = store.prepareReset("password@example.com")!;
  await store.resetPassword(unlock.token, "unlocked-password");
  assert.equal((await store.login(user.name, "unlocked-password")).id, user.id);
});

test("profile validation and account deletion remove personal records while preserving anonymous results and opponents", async (t) => {
  const { store } = fixture(t);
  const user = await store.create("注销玩家", password),
    opponent = await store.create("保留对手", password);
  const token = store.session(user);
  store.result("completed", user.id, opponent.id, user.id, "五子连珠");
  assert.throws(
    () => store.updateProfile(user.id, "保留对手", 0),
    /昵称已被使用/,
  );
  assert.throws(() => store.updateProfile(user.id, "新昵称", 99), /头像/);
  assert.throws(() => store.updateProfile(user.id, "<script>", 0), /昵称/);
  store.updateProfile(user.id, "新昵称", 3);
  const bind = await store.prepareEmail(
    user.id,
    "delete@example.com",
    password,
  );
  await assert.rejects(
    store.deleteAccount(user.id, password, "注销玩家"),
    /当前昵称/,
  );
  await assert.rejects(store.deleteAccount(user.id, "wrong", "新昵称"));
  assert.ok(store.resolve(token));
  await store.deleteAccount(user.id, password, "新昵称");
  assert.equal(store.get(user.id), null);
  assert.equal(store.resolve(token), null);
  assert.throws(() => store.confirmEmail(bind.token));
  const result = store.db.prepare("SELECT * FROM results").get()!;
  assert.equal(result.black_id, null);
  assert.equal(result.winner, null);
  assert.equal(result.white_id, opponent.id);
  assert.equal(store.get(opponent.id)!.losses, 1);
  assert.equal(
    store.db
      .prepare("SELECT count(*) AS n FROM sessions WHERE user_id=?")
      .get(user.id)!.n,
    0,
  );
});

test("new accounts start with 1000 points; guests also have 1000 points", async (t) => {
  const { store } = fixture(t);
  const guest = await store.create(null);
  assert.equal(guest.points, 1000);
  const member = await store.create("新玩家", password);
  assert.equal(member.points, 1000);
});

test("gomoku/xiangqi winner gains 10 points, loser loses 10 points, draw no change", async (t) => {
  const { store } = fixture(t);
  const alice = await store.create("爱丽丝", password);
  const bob = await store.create("鲍勃", password);
  store.result("match-1", alice.id, bob.id, alice.id, "连五", "gomoku");
  const afterAlice = store.get(alice.id)!;
  const afterBob = store.get(bob.id)!;
  assert.equal(afterAlice.points, 1010);
  assert.equal(afterBob.points, 990);
  store.result("match-2", alice.id, bob.id, null, "和棋", "xiangqi");
  assert.equal(store.get(alice.id)!.points, 1010);
  assert.equal(store.get(bob.id)!.points, 990);
});

test("points never go below zero", async (t) => {
  const { store } = fixture(t);
  const alice = await store.create("低分玩家", password);
  const bob = await store.create("高分玩家", password);
  store.db.prepare("UPDATE users SET points=5 WHERE id=?").run(alice.id);
  assert.equal(store.get(alice.id)!.points, 5);
  store.result("match-floor", bob.id, alice.id, bob.id, "测试", "gomoku");
  assert.equal(store.get(alice.id)!.points, 0);
  assert.equal(store.get(bob.id)!.points, 1010);
});

test("doudizhu updates points based on entertainment score", async (t) => {
  const { store } = fixture(t);
  const landlord = await store.create("地主", password);
  const farmer1 = await store.create("农民甲", password);
  const farmer2 = await store.create("农民乙", password);
  store.cardResult(
    "ddz-1",
    [
      { userId: landlord.id, role: "landlord", won: true, score: 2 },
      { userId: farmer1.id, role: "farmer", won: false, score: -1 },
      { userId: farmer2.id, role: "farmer", won: false, score: -1 },
    ],
    "landlord",
    "地主先出完",
    1,
    1,
    false,
  );
  assert.equal(store.get(landlord.id)!.points, 1020);
  assert.equal(store.get(farmer1.id)!.points, 990);
  assert.equal(store.get(farmer2.id)!.points, 990);
});

test("mahjong updates points based on entertainment score", async (t) => {
  const { store } = fixture(t);
  const east = await store.create("东家", password);
  const south = await store.create("南家", password);
  const west = await store.create("西家", password);
  const north = await store.create("北家", password);
  store.mahjongResult(
    "mj-1",
    [
      { userId: east.id, won: true, lost: false, score: 3 },
      { userId: south.id, won: false, lost: true, score: -1 },
      { userId: west.id, won: false, lost: true, score: -1 },
      { userId: north.id, won: false, lost: true, score: -1 },
    ],
    { kind: "self-draw", winner: 0, loser: null, reason: "东位自摸" },
  );
  assert.equal(store.get(east.id)!.points, 1030);
  assert.equal(store.get(south.id)!.points, 990);
  assert.equal(store.get(west.id)!.points, 990);
  assert.equal(store.get(north.id)!.points, 990);
  store.mahjongResult(
    "mj-2",
    [
      { userId: east.id, won: false, lost: true, score: 0 },
      { userId: south.id, won: false, lost: false, score: 0 },
      { userId: west.id, won: false, lost: false, score: 0 },
      { userId: north.id, won: false, lost: false, score: 0 },
    ],
    { kind: "forfeit", winner: null, loser: 0, reason: "东位退出" },
  );
  assert.equal(store.get(east.id)!.points, 1030);
  assert.equal(store.get(south.id)!.points, 990);
});

test("leaderboard returns top players sorted by points, then wins", async (t) => {
  const { store } = fixture(t);
  const guest = await store.create(null);
  const alice = await store.create("爱丽丝", password);
  const bob = await store.create("鲍勃", password);
  const charlie = await store.create("查理", password);
  store.db.prepare("UPDATE users SET points=1500, wins=10 WHERE id=?").run(alice.id);
  store.db.prepare("UPDATE users SET points=1200, wins=5 WHERE id=?").run(bob.id);
  store.db.prepare("UPDATE users SET points=1200, wins=8 WHERE id=?").run(charlie.id);
  const board = store.leaderboard(50);
  assert.ok(!board.some((u) => u.id === guest.id));
  assert.equal(board[0].id, alice.id);
  assert.equal(board[1].id, charlie.id);
  assert.equal(board[2].id, bob.id);
  assert.equal(board[0].points, 1500);
});

test("result is idempotent: duplicate settlement does not double-award points", async (t) => {
  const { store } = fixture(t);
  const alice = await store.create("爱丽丝", password);
  const bob = await store.create("鲍勃", password);
  store.result("match-idempotent", alice.id, bob.id, alice.id, "连五", "gomoku");
  const pointsAfterFirst = store.get(alice.id)!.points;
  store.result("match-idempotent", alice.id, bob.id, alice.id, "连五", "gomoku");
  const pointsAfterSecond = store.get(alice.id)!.points;
  assert.equal(pointsAfterFirst, pointsAfterSecond);
  assert.equal(pointsAfterFirst, 1010);
});

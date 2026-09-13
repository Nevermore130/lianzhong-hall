import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { get } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { createHallServer } from "../server/app.ts";
import {
  configuredMail,
  localMailbox,
  type AccountMail,
} from "../server/mail.ts";
import type { Snapshot, User } from "../shared/protocol.ts";
import type { DeviceSession } from "../shared/accounts.ts";

const password = "api-test-password";
const cookieOf = (response: Response) =>
  response.headers.getSetCookie()[0]?.split(";")[0] ?? "";
async function setup(t: TestContext) {
  const mails: AccountMail[] = [];
  const app = createHallServer({
    mailer: {
      mode: "local",
      inboxUrl: "http://127.0.0.1:3089/",
      async send(mail) {
        mails.push(mail);
      },
    },
  });
  await new Promise<void>((resolve) =>
    app.server.listen(0, "127.0.0.1", resolve),
  );
  t.after(() => app.close());
  const origin = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  async function request(path: string, data?: unknown, cookie = "") {
    return fetch(`${origin}/api/${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: cookie,
        "User-Agent": "Windows Chrome/100",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  }
  async function register(name: string) {
    const response = await request("register", { name, password });
    assert.equal(response.status, 200);
    return {
      cookie: cookieOf(response),
      user: (await response.json()).user as User,
    };
  }
  async function socket(cookie: string) {
    const ws = new WebSocket(origin.replace("http", "ws") + "/ws", {
      headers: { Origin: origin, Cookie: cookie },
    });
    const [raw] = await once(ws, "message");
    return { ws, snapshot: JSON.parse(raw.toString()) as Snapshot };
  }
  const token = () => new URL(mails.at(-1)!.link).hash.split("=")[1];
  return { ...app, mails, request, register, socket, token };
}

test("HTTP guest upgrade retains identity and results, rotates session and reconnects to the same seat", async (t) => {
  const app = await setup(t);
  const guest = await app.request("guest", {}),
    oldCookie = cookieOf(guest),
    { user } = await guest.json();
  app.accounts.db
    .prepare("UPDATE users SET wins=5,losses=2 WHERE id=?")
    .run(user.id);
  const { ws } = await app.socket(oldCookie);
  app.hall.dispatch(user.id, { type: "join", roomId: "1001" });
  app.hall.dispatch(user.id, { type: "sit", seat: 0 });
  const closed = once(ws, "close");
  const upgraded = await app.request(
    "register",
    { name: "游客保留五胜", password },
    oldCookie,
  );
  assert.equal(upgraded.status, 200);
  const upgradedUser = (await upgraded.json()).user;
  assert.equal(upgradedUser.id, user.id);
  assert.equal(upgradedUser.wins, 5);
  assert.equal(upgradedUser.losses, 2);
  assert.equal(upgradedUser.guest, false);
  assert.notEqual(cookieOf(upgraded), oldCookie);
  assert.equal((await closed)[0], 4001);
  assert.equal(
    (await (await app.request("me", undefined, oldCookie)).json()).user,
    null,
  );
  const next = await app.socket(cookieOf(upgraded));
  assert.equal(next.snapshot.roomId, "1001");
  assert.equal(next.snapshot.rooms[0].seats[0]!.userId, user.id);
});

test("profile broadcasts fresh nickname/avatar; verified email never enters public snapshots", async (t) => {
  const app = await setup(t),
    a = await app.register("资料甲"),
    b = await app.register("资料乙");
  app.accounts.db
    .prepare("UPDATE users SET email=? WHERE id=?")
    .run("private@example.com", a.user.id);
  await app.socket(a.cookie);
  const observer = await app.socket(b.cookie);
  const changed = once(observer.ws, "message");
  const response = await app.request(
    "profile",
    { name: "新棋友昵称", avatar: 4 },
    a.cookie,
  );
  assert.equal(response.status, 200);
  const [raw] = await changed;
  const snapshot = JSON.parse(raw.toString()) as Snapshot;
  assert.equal(
    snapshot.players.find((p) => p.id === a.user.id)!.name,
    "新棋友昵称",
  );
  assert.equal(snapshot.players.find((p) => p.id === a.user.id)!.avatar, 4);
  assert.ok(!raw.toString().includes("private@example.com"));
  assert.ok(!("email" in (await response.json()).user));
  assert.equal(
    (await (await app.request("account", undefined, a.cookie)).json()).profile
      .email,
    "private@example.com",
  );
  assert.equal((await app.request("account")).status, 401);
});

test("device revocation closes only the chosen socket; password change replaces current cookie and evicts other sessions", async (t) => {
  const app = await setup(t),
    a = await app.register("设备测试"),
    b = await app.register("旁人设备");
  const login = await app.request("login", { name: a.user.name, password }),
    otherCookie = cookieOf(login);
  const current = await app.socket(a.cookie),
    other = await app.socket(otherCookie);
  const list = (
    await (await app.request("sessions", undefined, a.cookie)).json()
  ).sessions as DeviceSession[];
  const foreign = (
    await (await app.request("sessions", undefined, b.cookie)).json()
  ).sessions[0];
  assert.equal(
    (await app.request("sessions/revoke", { sessionId: foreign.id }, a.cookie))
      .status,
    404,
  );
  const closed = once(other.ws, "close");
  assert.equal(
    (
      await app.request(
        "sessions/revoke",
        { sessionId: list.find((s) => !s.current)!.id },
        a.cookie,
      )
    ).status,
    200,
  );
  assert.equal((await closed)[0], 4001);
  assert.equal(current.ws.readyState, WebSocket.OPEN);
  const again = cookieOf(
    await app.request("login", { name: a.user.name, password }),
  );
  assert.equal(
    (
      await app.request(
        "password/change",
        { currentPassword: "wrong", newPassword: "updated-password" },
        a.cookie,
      )
    ).status,
    400,
  );
  const currentClosed = once(current.ws, "close");
  const change = await app.request(
    "password/change",
    { currentPassword: password, newPassword: "updated-password" },
    a.cookie,
  );
  assert.equal(change.status, 200);
  assert.notEqual(cookieOf(change), a.cookie);
  await currentClosed;
  for (const old of [a.cookie, again])
    assert.equal(
      (await (await app.request("me", undefined, old)).json()).user,
      null,
    );
  assert.equal(
    (await (await app.request("me", undefined, cookieOf(change))).json()).user
      .id,
    a.user.id,
  );
  const fresh = cookieOf(
    await app.request("login", {
      name: a.user.name,
      password: "updated-password",
    }),
  );
  assert.equal(
    (
      await app.request(
        "sessions/revoke-others",
        { password: "updated-password" },
        cookieOf(change),
      )
    ).status,
    200,
  );
  assert.equal(
    (await (await app.request("me", undefined, fresh)).json()).user,
    null,
  );
  const renew = await app.request("session/refresh", {}, cookieOf(change));
  assert.equal(renew.status, 200);
  assert.equal(cookieOf(renew), cookieOf(change));
});

test("email binding and recovery HTTP flow uses local delivery, generic responses and no automatic login", async (t) => {
  const app = await setup(t),
    a = await app.register("找回账号");
  assert.equal(
    (
      await app.request(
        "email/request",
        { email: "recover@example.com", password },
        a.cookie,
      )
    ).status,
    200,
  );
  assert.equal(app.mails.length, 1);
  assert.equal(app.mails[0].to, "recover@example.com");
  const confirmation = await app.request("email/confirm", {
    token: app.token(),
  });
  assert.equal(confirmation.status, 200);
  assert.equal(cookieOf(confirmation), "");
  assert.equal(
    (await (await app.request("me", undefined, a.cookie)).json()).user,
    null,
  );
  assert.equal(
    (await app.request("email/confirm", { token: app.token() })).status,
    400,
  );
  const signedIn = await app.request("login", {
    name: "recover@example.com",
    password,
  });
  const unknown = await app.request("password/forgot", {
      email: "unknown@example.com",
    }),
    known = await app.request("password/forgot", {
      email: "recover@example.com",
    });
  assert.equal(known.status, unknown.status);
  assert.deepEqual(await known.json(), await unknown.json());
  assert.equal(app.mails.length, 2);
  const reset = await app.request("password/reset", {
    token: app.token(),
    password: "recovered-password",
  });
  assert.equal(reset.status, 200);
  assert.equal(cookieOf(reset), "");
  assert.equal(
    (await (await app.request("me", undefined, cookieOf(signedIn))).json())
      .user,
    null,
  );
  assert.equal(
    (
      await app.request("login", {
        name: a.user.name,
        password: "recovered-password",
      })
    ).status,
    200,
  );
  assert.equal(
    (await app.request("password/reset", { token: app.token(), password }))
      .status,
    400,
  );
});

test("account deletion rejects an active game, then removes hall presence and revokes every session", async (t) => {
  const app = await setup(t),
    a = await app.register("注销甲"),
    b = await app.register("对手乙");
  const client = await app.socket(a.cookie);
  await app.socket(b.cookie);
  for (const [index, user] of [a.user, b.user].entries()) {
    app.hall.dispatch(user.id, { type: "join", roomId: "1001" });
    app.hall.dispatch(user.id, { type: "sit", seat: index });
  }
  for (const user of [a.user, b.user])
    app.hall.dispatch(user.id, { type: "ready" });
  assert.equal(app.hall.isPlaying(a.user.id), true);
  assert.equal(
    (
      await app.request(
        "account/delete",
        { confirmation: a.user.name, password },
        a.cookie,
      )
    ).status,
    409,
  );
  assert.ok(app.accounts.get(a.user.id));
  app.hall.dispatch(a.user.id, { type: "resign" });
  app.hall.dispatch(a.user.id, {
    type: "chat",
    text: "注销前测试",
    channel: "hall",
    clientId: randomUUID(),
  });
  const closed = once(client.ws, "close");
  const response = await app.request(
    "account/delete",
    { confirmation: a.user.name, password },
    a.cookie,
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.getSetCookie()[0], /Max-Age=0/);
  assert.equal((await closed)[0], 4001);
  assert.equal(app.accounts.get(a.user.id), null);
  assert.equal(app.hall.players.has(a.user.id), false);
  assert.ok(!app.hall.messages.some((m) => m.userId === a.user.id));
  assert.equal(
    (await app.request("profile", { name: "死会话", avatar: 0 }, a.cookie))
      .status,
    401,
  );
});

test("local inbox is loopback-only, escapes content, and is forbidden in production; SMTP validates configuration without sending", async (t) => {
  const mailbox = await localMailbox(0);
  t.after(() => mailbox.close!());
  await mailbox.send({
    to: "qa@example.com",
    subject: "<script>test</script>",
    text: "test",
    link: "http://localhost/#test",
  });
  const page = await fetch(mailbox.inboxUrl!);
  assert.match(
    page.headers.get("content-security-policy")!,
    /frame-ancestors 'none'/,
  );
  const html = await page.text();
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  const forbidden = await new Promise<number | undefined>((resolve, reject) => {
    get(mailbox.inboxUrl!, { headers: { Host: "attacker.example" } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    }).on("error", reject);
  });
  assert.equal(forbidden, 403);
  await assert.rejects(
    configuredMail({ NODE_ENV: "production", MAIL_MODE: "local" }),
    /生产环境/,
  );
  assert.equal(
    (await configuredMail({ NODE_ENV: "production" })).mode,
    "disabled",
  );
  await assert.rejects(configuredMail({ MAIL_MODE: "smtp" }), /SMTP 需要/);
  await assert.rejects(
    configuredMail({
      MAIL_MODE: "smtp",
      SMTP_HOST: "smtp.example.com",
      SMTP_FROM: "test@example.com",
      APP_ORIGIN: "http://example.com",
    }),
    /HTTPS/,
  );
  const smtp = await configuredMail({
    MAIL_MODE: "smtp",
    SMTP_HOST: "smtp.example.com",
    SMTP_FROM: "test@example.com",
    APP_ORIGIN: "https://example.com",
  });
  assert.equal(smtp.mode, "smtp");
  await smtp.close!();
});

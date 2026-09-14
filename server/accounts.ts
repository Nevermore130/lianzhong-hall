import type { MahjongResult } from "../shared/mahjong.ts";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { User } from "../shared/protocol.ts";
import {
  avatars,
  type AccountProfile,
  type DeviceSession,
} from "../shared/accounts.ts";
import { AccountError } from "./account-errors.ts";

const derive = promisify(scrypt);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const SESSION_IDLE_MS = 7 * 86400_000;
export const SESSION_MAX_MS = 30 * 86400_000;
const LOCK_MS = 15 * 60_000;
type Row = {
  id: string;
  name: string;
  guest: number;
  password: string | null;
  wins: number;
  losses: number;
  avatar: number;
  email: string | null;
  created_at: number;
  revision: number;
};
type SessionRow = {
  id: string;
  token: string;
  user_id: string;
  expires: number;
  created_at: number;
  last_seen: number;
  absolute_expires: number;
  device: string;
};
type Verification = {
  token: string;
  user_id: string;
  purpose: "email" | "reset";
  value: string;
  expires: number;
  created_at: number;
  revision: number;
};
type Guard = () => void;
const noop = () => {};
const publicUser = (row: Row): User => ({
  id: row.id,
  name: row.name,
  guest: !!row.guest,
  wins: row.wins,
  losses: row.losses,
  avatar: row.avatar,
});
const normalizeName = (name: unknown) => {
  const value = typeof name === "string" ? name.trim().normalize("NFKC") : "";
  if (!/^[\p{L}\p{N}_-]{2,16}$/u.test(value))
    throw new AccountError("昵称需为 2–16 位中文、字母、数字、下划线或连字符");
  return value;
};
export function normalizeEmail(email: unknown): string {
  const value = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (
    value.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(
      value,
    )
  )
    throw new AccountError("请输入有效的邮箱地址");
  return value;
}
async function encodePassword(password: unknown): Promise<string> {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 72
  )
    throw new AccountError("密码长度需为 8–72 位");
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${((await derive(password, salt, 64)) as Buffer).toString("hex")}`;
}
export function deviceName(agent: string): string {
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /Firefox\//.test(agent)
      ? "Firefox"
      : /Chrome\//.test(agent)
        ? "Chrome"
        : /Safari\//.test(agent)
          ? "Safari"
          : "浏览器";
  const os = /Android/.test(agent)
    ? "Android"
    : /iPhone|iPad/.test(agent)
      ? "iOS"
      : /Windows/.test(agent)
        ? "Windows"
        : /Macintosh|Mac OS/.test(agent)
          ? "macOS"
          : /Linux/.test(agent)
            ? "Linux"
            : "未知设备";
  return `${browser} · ${os}`;
}

export class Accounts {
  db: DatabaseSync;
  constructor(
    path: string,
    private now = () => Date.now(),
  ) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, guest INTEGER NOT NULL, password TEXT, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS results (id TEXT PRIMARY KEY, black_id TEXT, white_id TEXT, winner TEXT, reason TEXT, ended INTEGER NOT NULL);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS card_results (
      id TEXT PRIMARY KEY, winner TEXT, reason TEXT NOT NULL, bid INTEGER NOT NULL,
      multiplier INTEGER NOT NULL, spring INTEGER NOT NULL, ended INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS card_result_players (
        match_id TEXT NOT NULL REFERENCES card_results(id), seat INTEGER NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL, role TEXT NOT NULL,
        won INTEGER NOT NULL, score INTEGER NOT NULL, PRIMARY KEY(match_id,seat));`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS mahjong_results (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, winner INTEGER, loser INTEGER,
      reason TEXT NOT NULL, ended INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS mahjong_result_players (
      match_id TEXT NOT NULL REFERENCES mahjong_results(id), seat INTEGER NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL, outcome TEXT NOT NULL,
      score INTEGER NOT NULL, PRIMARY KEY(match_id,seat));`);
    this.transaction(() => {
      const add = (table: string, name: string, definition: string) => {
        if (
          !this.db
            .prepare(`PRAGMA table_info(${table})`)
            .all()
            .some((r) => r.name === name)
        )
          this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      };
      add("users", "avatar", "INTEGER NOT NULL DEFAULT 0");
      add("results", "game", "TEXT NOT NULL DEFAULT 'gomoku'");
      add("users", "email", "TEXT COLLATE NOCASE");
      add("users", "created_at", "INTEGER NOT NULL DEFAULT 0");
      add("users", "revision", "INTEGER NOT NULL DEFAULT 0");
      add("sessions", "id", "TEXT");
      add("sessions", "device", "TEXT NOT NULL DEFAULT '原有登录设备'");
      add("sessions", "created_at", "INTEGER NOT NULL DEFAULT 0");
      add("sessions", "last_seen", "INTEGER NOT NULL DEFAULT 0");
      add("sessions", "absolute_expires", "INTEGER NOT NULL DEFAULT 0");
      this.db
        .prepare("UPDATE users SET created_at = ? WHERE created_at = 0")
        .run(this.now());
      this.db
        .prepare(
          "UPDATE sessions SET created_at = expires - ? WHERE created_at = 0",
        )
        .run(SESSION_IDLE_MS);
      this.db.exec(
        "UPDATE sessions SET last_seen = created_at WHERE last_seen = 0",
      );
      this.db
        .prepare(
          "UPDATE sessions SET absolute_expires = created_at + ? WHERE absolute_expires = 0",
        )
        .run(SESSION_MAX_MS);
      for (const row of this.db
        .prepare("SELECT token FROM sessions WHERE id IS NULL")
        .all())
        this.db
          .prepare("UPDATE sessions SET id = ? WHERE token = ?")
          .run(randomUUID(), row.token);
      this.db
        .exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email) WHERE email IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS sessions_id ON sessions(id);
        CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
        CREATE TABLE IF NOT EXISTS login_failures (key TEXT PRIMARY KEY, count INTEGER NOT NULL, started INTEGER NOT NULL, locked_until INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS verifications (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL, value TEXT NOT NULL, expires INTEGER NOT NULL, created_at INTEGER NOT NULL, revision INTEGER NOT NULL);
        PRAGMA user_version=2;`);
      this.db
        .prepare(
          "DELETE FROM sessions WHERE expires <= ? OR absolute_expires <= ?",
        )
        .run(this.now(), this.now());
      this.db
        .prepare("DELETE FROM verifications WHERE expires <= ?")
        .run(this.now());
      this.db
        .prepare(
          "DELETE FROM login_failures WHERE locked_until <= ? AND started <= ?",
        )
        .run(this.now(), this.now() - LOCK_MS);
    });
  }
  transaction<T>(run: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = run();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  private row(id: string): Row | undefined {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      Row | undefined;
  }
  get(id: string): User | null {
    const row = this.row(id);
    return row ? publicUser(row) : null;
  }
  profile(id: string): AccountProfile {
    const row = this.row(id);
    if (!row) throw new AccountError("登录已失效", 401);
    return { ...publicUser(row), email: row.email, createdAt: row.created_at };
  }
  private uniqueError(error: unknown): never {
    if (String(error).includes("users.email"))
      throw new AccountError("这个邮箱已绑定其他账号");
    if (String(error).includes("users.name"))
      throw new AccountError("这个昵称已被使用，请换一个");
    throw error;
  }
  async create(name: unknown, password?: unknown): Promise<User> {
    const guest = password === undefined;
    const normalized = guest
      ? `棋友_${randomBytes(6).toString("hex")}`
      : normalizeName(name);
    const encoded = guest ? null : await encodePassword(password);
    const id = randomUUID();
    try {
      this.db
        .prepare(
          "INSERT INTO users(id,name,guest,password,created_at) VALUES(?,?,?,?,?)",
        )
        .run(id, normalized, guest ? 1 : 0, encoded, this.now());
    } catch (error) {
      this.uniqueError(error);
    }
    return this.get(id)!;
  }
  async upgrade(
    id: string,
    name: unknown,
    password: unknown,
    guard: Guard = noop,
  ): Promise<User> {
    const normalized = normalizeName(name),
      encoded = await encodePassword(password);
    guard();
    try {
      this.transaction(() => {
        const changed = this.db
          .prepare(
            "UPDATE users SET name=?, password=?, guest=0, revision=revision+1 WHERE id=? AND guest=1",
          )
          .run(normalized, encoded, id);
        if (!changed.changes)
          throw new AccountError("游客身份已变化，请刷新后重试", 409);
        this.revokeAll(id);
      });
    } catch (error) {
      this.uniqueError(error);
    }
    return this.get(id)!;
  }
  private reserveAttempt(key: string) {
    const now = this.now();
    const row = this.db
      .prepare("SELECT * FROM login_failures WHERE key=?")
      .get(key) as
      { count: number; started: number; locked_until: number } | undefined;
    if (row && row.locked_until > now)
      throw new AccountError(
        "尝试次数过多，请 15 分钟后重试，或通过邮箱找回密码",
        429,
        Math.ceil((row.locked_until - now) / 1000),
      );
    const count = row && now - row.started < LOCK_MS ? row.count + 1 : 1;
    const started = row && now - row.started < LOCK_MS ? row.started : now;
    this.db
      .prepare("INSERT OR REPLACE INTO login_failures VALUES(?,?,?,?)")
      .run(key, count, started, count >= 5 ? now + LOCK_MS : 0);
  }
  private async checkPassword(
    row: Row | undefined,
    password: unknown,
    key: string,
  ): Promise<Row> {
    this.reserveAttempt(key);
    const [salt, expected] = row?.password?.split(":") ?? [
      "invalid-account-salt",
      "00".repeat(64),
    ];
    const supplied =
      typeof password === "string" && password.length <= 72 ? password : "";
    const actual = (await derive(supplied, salt, 64)) as Buffer;
    const current = row && this.row(row.id);
    if (
      !current ||
      row?.guest ||
      typeof password !== "string" ||
      password.length > 72 ||
      !timingSafeEqual(actual, Buffer.from(expected, "hex")) ||
      current.password !== row.password ||
      current.revision !== row.revision
    )
      throw new AccountError("昵称、邮箱或密码不正确");
    this.db.prepare("DELETE FROM login_failures WHERE key=?").run(key);
    return current;
  }
  async login(name: unknown, password: unknown): Promise<User> {
    const normalized =
      typeof name === "string" ? name.trim().normalize("NFKC") : "";
    const row = this.db
      .prepare("SELECT * FROM users WHERE (name=? OR email=?) AND guest=0")
      .get(normalized, normalized.toLowerCase()) as Row | undefined;
    const key = row
      ? `login:${row.id}`
      : `unknown:${hash(normalized.toLowerCase())}`;
    return publicUser(await this.checkPassword(row, password, key));
  }
  private async authenticate(id: string, password: unknown): Promise<Row> {
    return this.checkPassword(this.row(id), password, `reauth:${id}`);
  }
  session(user: User, agent = ""): string {
    if (!this.get(user.id)) throw new AccountError("账号不存在", 401);
    const token = randomBytes(32).toString("hex"),
      now = this.now();
    this.db
      .prepare(
        "INSERT INTO sessions(token,user_id,expires,id,device,created_at,last_seen,absolute_expires) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        hash(token),
        user.id,
        now + SESSION_IDLE_MS,
        randomUUID(),
        deviceName(agent),
        now,
        now,
        now + SESSION_MAX_MS,
      );
    return token;
  }
  private sessionRow(token: string): SessionRow | undefined {
    return this.db
      .prepare(
        "SELECT * FROM sessions WHERE token=? AND expires>? AND absolute_expires>?",
      )
      .get(hash(token), this.now(), this.now()) as SessionRow | undefined;
  }
  resolve(token: string): User | null {
    const row = this.sessionRow(token);
    return row ? this.get(row.user_id) : null;
  }
  touch(token: string) {
    this.db
      .prepare("UPDATE sessions SET last_seen=? WHERE token=? AND last_seen<?")
      .run(this.now(), hash(token), this.now() - 60_000);
  }
  renew(token: string): { user: User; maxAge: number } {
    const row = this.sessionRow(token),
      user = row && this.get(row.user_id);
    if (!row || !user) throw new AccountError("登录已失效，请重新登录", 401);
    const expires = Math.min(
      this.now() + SESSION_IDLE_MS,
      row.absolute_expires,
    );
    this.db
      .prepare("UPDATE sessions SET expires=?, last_seen=? WHERE token=?")
      .run(expires, this.now(), hash(token));
    return {
      user,
      maxAge: Math.max(0, Math.floor((expires - this.now()) / 1000)),
    };
  }
  sessions(id: string, token: string): DeviceSession[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM sessions WHERE user_id=? AND expires>? AND absolute_expires>? ORDER BY last_seen DESC",
        )
        .all(id, this.now(), this.now()) as SessionRow[]
    ).map((row) => ({
      id: row.id,
      device: row.device,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen,
      expiresAt: row.expires,
      current: row.token === hash(token),
    }));
  }
  revoke(token: string) {
    this.db.prepare("DELETE FROM sessions WHERE token=?").run(hash(token));
  }
  revokeAll(id: string) {
    this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
  }
  revokeDevice(id: string, sessionId: unknown, current: string) {
    if (typeof sessionId !== "string") throw new AccountError("请选择登录设备");
    const row = this.db
      .prepare("SELECT token FROM sessions WHERE id=? AND user_id=?")
      .get(sessionId, id);
    if (!row) throw new AccountError("该设备已退出", 404);
    if (row.token === hash(current))
      throw new AccountError("当前设备请使用退出账号");
    this.db
      .prepare("DELETE FROM sessions WHERE id=? AND user_id=?")
      .run(sessionId, id);
  }
  async revokeOthers(
    id: string,
    current: string,
    password: unknown,
    guard: Guard = noop,
  ) {
    await this.authenticate(id, password);
    guard();
    this.db
      .prepare("DELETE FROM sessions WHERE user_id=? AND token<>?")
      .run(id, hash(current));
  }
  updateProfile(id: string, name: unknown, avatar: unknown): User {
    const normalized = normalizeName(name);
    if (
      !Number.isInteger(avatar) ||
      typeof avatar !== "number" ||
      avatar < 0 ||
      avatar >= avatars.length
    )
      throw new AccountError("请选择列表中的头像");
    try {
      const result = this.db
        .prepare("UPDATE users SET name=?,avatar=? WHERE id=? AND guest=0")
        .run(normalized, avatar, id);
      if (!result.changes) throw new AccountError("请先注册正式账号");
    } catch (error) {
      this.uniqueError(error);
    }
    return this.get(id)!;
  }
  async changePassword(
    id: string,
    current: unknown,
    next: unknown,
    guard: Guard = noop,
  ): Promise<User> {
    const row = await this.authenticate(id, current),
      encoded = await encodePassword(next);
    guard();
    this.transaction(() => {
      const changed = this.db
        .prepare(
          "UPDATE users SET password=?,revision=revision+1 WHERE id=? AND password=? AND revision=?",
        )
        .run(encoded, id, row.password, row.revision);
      if (!changed.changes)
        throw new AccountError("账号已更新，请重新操作", 409);
      this.revokeAll(id);
      this.db.prepare("DELETE FROM verifications WHERE user_id=?").run(id);
    });
    return this.get(id)!;
  }
  async prepareEmail(
    id: string,
    email: unknown,
    password: unknown,
    guard: Guard = noop,
  ) {
    const value = normalizeEmail(email),
      row = await this.authenticate(id, password);
    guard();
    if (row.email === value) throw new AccountError("这个邮箱已经验证并绑定");
    if (this.db.prepare("SELECT id FROM users WHERE email=?").get(value))
      throw new AccountError("这个邮箱已绑定其他账号");
    return this.issueVerification(row, "email", value);
  }
  private issueVerification(
    row: Row,
    purpose: "email" | "reset",
    value: string,
  ) {
    const previous = this.db
      .prepare(
        "SELECT created_at FROM verifications WHERE user_id=? AND purpose=? ORDER BY created_at DESC LIMIT 1",
      )
      .get(row.id, purpose);
    if (previous && this.now() - Number(previous.created_at) < 60_000)
      throw new AccountError("验证邮件已发送，请稍后再试", 429, 60);
    const token = randomBytes(32).toString("hex"),
      expires = this.now() + 15 * 60_000;
    this.transaction(() => {
      this.db
        .prepare("DELETE FROM verifications WHERE user_id=? AND purpose=?")
        .run(row.id, purpose);
      this.db
        .prepare("INSERT INTO verifications VALUES(?,?,?,?,?,?,?)")
        .run(
          hash(token),
          row.id,
          purpose,
          value,
          expires,
          this.now(),
          row.revision,
        );
    });
    return { token, email: value, expires, userId: row.id };
  }
  prepareReset(email: unknown) {
    const normalized = normalizeEmail(email);
    const row = this.db
      .prepare("SELECT * FROM users WHERE email=? AND guest=0")
      .get(normalized) as Row | undefined;
    if (!row) return null;
    try {
      return this.issueVerification(row, "reset", normalized);
    } catch (error) {
      if (error instanceof AccountError && error.status === 429) return null;
      throw error;
    }
  }
  discardVerification(token: string) {
    this.db.prepare("DELETE FROM verifications WHERE token=?").run(hash(token));
  }
  private verification(token: unknown, purpose: string): Verification {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      throw new AccountError("验证链接无效或已过期，请重新发送");
    const row = this.db
      .prepare(
        "SELECT v.* FROM verifications v JOIN users u ON u.id=v.user_id AND u.revision=v.revision WHERE v.token=? AND v.purpose=? AND v.expires>?",
      )
      .get(hash(token), purpose, this.now()) as Verification | undefined;
    if (!row) throw new AccountError("验证链接无效或已过期，请重新发送");
    return row;
  }
  confirmEmail(token: unknown): string {
    const row = this.verification(token, "email");
    try {
      this.transaction(() => {
        this.db
          .prepare("UPDATE users SET email=?,revision=revision+1 WHERE id=?")
          .run(row.value, row.user_id);
        this.db
          .prepare("DELETE FROM verifications WHERE user_id=?")
          .run(row.user_id);
        this.revokeAll(row.user_id);
      });
    } catch (error) {
      this.uniqueError(error);
    }
    return row.user_id;
  }
  async resetPassword(token: unknown, password: unknown): Promise<string> {
    this.verification(token, "reset");
    const encoded = await encodePassword(password);
    return this.transaction(() => {
      const row = this.verification(token, "reset");
      this.db
        .prepare("UPDATE users SET password=?,revision=revision+1 WHERE id=?")
        .run(encoded, row.user_id);
      this.revokeAll(row.user_id);
      this.db
        .prepare("DELETE FROM verifications WHERE user_id=?")
        .run(row.user_id);
      this.db
        .prepare("DELETE FROM login_failures WHERE key IN (?,?)")
        .run(`login:${row.user_id}`, `reauth:${row.user_id}`);
      return row.user_id;
    });
  }
  async deleteAccount(
    id: string,
    password: unknown,
    confirmation: unknown,
    guard: Guard = noop,
  ) {
    const row = await this.authenticate(id, password);
    guard();
    if (confirmation !== row.name)
      throw new AccountError("请输入当前昵称确认注销");
    this.transaction(() => {
      const fresh = this.row(id);
      if (
        !fresh ||
        fresh.password !== row.password ||
        fresh.revision !== row.revision
      )
        throw new AccountError("账号已变化，请重新操作", 409);
      this.revokeAll(id);
      this.db.prepare("DELETE FROM verifications WHERE user_id=?").run(id);
      this.db
        .prepare("DELETE FROM login_failures WHERE key IN (?,?)")
        .run(`login:${id}`, `reauth:${id}`);
      for (const column of ["black_id", "white_id", "winner"])
        this.db
          .prepare(`UPDATE results SET ${column}=NULL WHERE ${column}=?`)
          .run(id);
      this.db.prepare("DELETE FROM users WHERE id=?").run(id);
    });
  }
  result(
    id: string,
    black: string,
    white: string,
    winner: string | null,
    reason: string,
    game: "gomoku" | "xiangqi" = "gomoku",
  ) {
    this.transaction(() => {
      const added = this.db
        .prepare(
          "INSERT OR IGNORE INTO results(id,black_id,white_id,winner,reason,ended,game) VALUES(?,?,?,?,?,?,?)",
        )
        .run(id, black, white, winner, reason, this.now(), game);
      if (added.changes && winner) {
        this.db.prepare("UPDATE users SET wins=wins+1 WHERE id=?").run(winner);
        this.db
          .prepare("UPDATE users SET losses=losses+1 WHERE id=?")
          .run(winner === black ? white : black);
      }
    });
  }
  mahjongResult(
    id: string,
    players: { userId: string; won: boolean; lost: boolean; score: number }[],
    result: MahjongResult,
  ) {
    this.transaction(() => {
      const added = this.db
        .prepare("INSERT OR IGNORE INTO mahjong_results VALUES(?,?,?,?,?,?)")
        .run(
          id,
          result.kind,
          result.winner,
          result.loser,
          result.reason,
          this.now(),
        );
      if (!added.changes) return;
      players.forEach((p, seat) => {
        this.db
          .prepare("INSERT INTO mahjong_result_players VALUES(?,?,?,?,?)")
          .run(
            id,
            seat,
            p.userId,
            p.won
              ? "win"
              : p.lost
                ? "loss"
                : result.kind === "draw"
                  ? "draw"
                  : "neutral",
            p.score,
          );
        if (p.won || p.lost)
          this.db
            .prepare(
              p.won
                ? "UPDATE users SET wins=wins+1 WHERE id=?"
                : "UPDATE users SET losses=losses+1 WHERE id=?",
            )
            .run(p.userId);
      });
    });
  }
  cardResult(
    id: string,
    players: {
      userId: string;
      role: "landlord" | "farmer";
      won: boolean;
      score: number;
    }[],
    winner: string | null,
    reason: string,
    bid: number,
    multiplier: number,
    spring: boolean,
  ) {
    this.transaction(() => {
      const added = this.db
        .prepare("INSERT OR IGNORE INTO card_results VALUES(?,?,?,?,?,?,?)")
        .run(id, winner, reason, bid, multiplier, spring ? 1 : 0, this.now());
      if (!added.changes) return;
      players.forEach((p, seat) => {
        this.db
          .prepare("INSERT INTO card_result_players VALUES(?,?,?,?,?,?)")
          .run(id, seat, p.userId, p.role, p.won ? 1 : 0, p.score);
        if (winner)
          this.db
            .prepare(
              p.won
                ? "UPDATE users SET wins=wins+1 WHERE id=?"
                : "UPDATE users SET losses=losses+1 WHERE id=?",
            )
            .run(p.userId);
      });
    });
  }
}

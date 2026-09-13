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

const derive = promisify(scrypt);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
type Row = {
  id: string;
  name: string;
  guest: number;
  password: string | null;
  wins: number;
  losses: number;
};
const publicUser = (row: Row): User => ({
  id: row.id,
  name: row.name,
  guest: !!row.guest,
  wins: row.wins,
  losses: row.losses,
});

export class Accounts {
  db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, guest INTEGER NOT NULL, password TEXT, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS results (id TEXT PRIMARY KEY, black_id TEXT, white_id TEXT, winner TEXT, reason TEXT, ended INTEGER NOT NULL);`);
    this.db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
  }
  get(id: string): User | null {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      Row | undefined;
    return row ? publicUser(row) : null;
  }
  async create(name: unknown, password?: unknown): Promise<User> {
    const guest = password === undefined;
    const normalized = guest
      ? `棋友_${randomBytes(3).toString("hex")}`
      : typeof name === "string"
        ? name.trim().normalize("NFKC")
        : "";
    if (!/^[\p{L}\p{N}_-]{2,16}$/u.test(normalized))
      throw new Error("昵称需为 2–16 位中文、字母、数字或下划线");
    let encoded: string | null = null;
    if (!guest) {
      if (
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 72
      )
        throw new Error("密码长度需为 8–72 位");
      const salt = randomBytes(16).toString("hex");
      encoded = `${salt}:${((await derive(password, salt, 64)) as Buffer).toString("hex")}`;
    }
    const id = randomUUID();
    try {
      this.db
        .prepare("INSERT INTO users(id,name,guest,password) VALUES(?,?,?,?)")
        .run(id, normalized, guest ? 1 : 0, encoded);
    } catch (error) {
      if (String(error).includes("UNIQUE"))
        throw new Error("这个昵称已被使用，请换一个");
      throw error;
    }
    return this.get(id)!;
  }
  async login(name: unknown, password: unknown): Promise<User> {
    if (
      typeof name !== "string" ||
      typeof password !== "string" ||
      password.length > 72
    )
      throw new Error("昵称或密码不正确");
    const row = this.db
      .prepare("SELECT * FROM users WHERE name = ? AND guest = 0")
      .get(name.trim().normalize("NFKC")) as Row | undefined;
    const [salt, expected] = row?.password?.split(":") ?? [
      "invalid-account-salt",
      "00".repeat(64),
    ];
    const actual = (await derive(password, salt, 64)) as Buffer;
    if (!row || !timingSafeEqual(actual, Buffer.from(expected, "hex")))
      throw new Error("昵称或密码不正确");
    return publicUser(row);
  }
  session(user: User): string {
    const token = randomBytes(32).toString("hex");
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(hash(token), user.id, Date.now() + 7 * 86400_000);
    return token;
  }
  resolve(token: string): User | null {
    const row = this.db
      .prepare(
        "SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE token = ? AND expires > ?",
      )
      .get(hash(token), Date.now()) as Row | undefined;
    return row ? publicUser(row) : null;
  }
  revoke(token: string) {
    this.db.prepare("DELETE FROM sessions WHERE token = ?").run(hash(token));
  }
  result(
    id: string,
    black: string,
    white: string,
    winner: string | null,
    reason: string,
  ) {
    this.db.exec("BEGIN");
    try {
      const added = this.db
        .prepare("INSERT OR IGNORE INTO results VALUES(?,?,?,?,?,?)")
        .run(id, black, white, winner, reason, Date.now());
      if (added.changes && winner) {
        this.db
          .prepare("UPDATE users SET wins = wins + 1 WHERE id = ?")
          .run(winner);
        this.db
          .prepare("UPDATE users SET losses = losses + 1 WHERE id = ?")
          .run(winner === black ? white : black);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

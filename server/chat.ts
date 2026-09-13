import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { User } from "../shared/protocol.ts";
import type { ChatChannel, ChatMessage, ChatPage } from "../shared/chat.ts";
import { AccountError } from "./account-errors.ts";

type Row = {
  id: string;
  seq: number;
  client_id: string;
  channel: ChatChannel;
  user_id: string;
  name: string;
  text: string;
  created_at: number;
};
const messageOf = (row: Row): ChatMessage => ({
  id: row.id,
  seq: row.seq,
  clientId: row.client_id,
  channel: row.channel,
  userId: row.user_id,
  name: row.name,
  text: row.text,
  time: row.created_at,
});
export function channelOf(value: unknown): ChatChannel {
  if (
    value === "hall" ||
    (typeof value === "string" && /^room:[0-9]{4,12}$/.test(value))
  )
    return value as ChatChannel;
  throw new AccountError("请选择大厅或当前房间频道");
}
export class ChatStore {
  constructor(
    private db: DatabaseSync,
    private now = () => Date.now(),
  ) {
    db.exec(`CREATE TABLE IF NOT EXISTS chat_messages (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL, channel TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL,
      UNIQUE(user_id, client_id));
      CREATE INDEX IF NOT EXISTS chat_channel_seq ON chat_messages(channel,seq);
      CREATE INDEX IF NOT EXISTS chat_sender_time ON chat_messages(user_id,created_at);
      CREATE TABLE IF NOT EXISTS chat_reads (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel TEXT NOT NULL, through_seq INTEGER NOT NULL,
        PRIMARY KEY(user_id,channel));
      CREATE TABLE IF NOT EXISTS room_sequence (id INTEGER PRIMARY KEY CHECK(id=1), value INTEGER NOT NULL);
      INSERT OR IGNORE INTO room_sequence VALUES(1,1012);
      CREATE TABLE IF NOT EXISTS default_rooms (name TEXT PRIMARY KEY, room_id TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS chat_revision (id INTEGER PRIMARY KEY CHECK(id=1), value INTEGER NOT NULL);
      INSERT OR IGNORE INTO chat_revision VALUES(1,0);
      CREATE TRIGGER IF NOT EXISTS chat_account_deleted AFTER DELETE ON users BEGIN UPDATE chat_revision SET value=value+1 WHERE id=1; END;`);
  }
  get revision() {
    return Number(
      this.db.prepare("SELECT value FROM chat_revision WHERE id=1").get()!
        .value,
    );
  }
  allocateRoomId() {
    return String(
      this.db
        .prepare(
          "UPDATE room_sequence SET value=value+1 WHERE id=1 RETURNING value",
        )
        .get()!.value,
    );
  }
  defaultRoomId(name: string): string {
    const existing = this.db
      .prepare("SELECT room_id FROM default_rooms WHERE name=?")
      .get(name);
    if (existing) return String(existing.room_id);
    const id = this.allocateRoomId();
    this.db
      .prepare("INSERT INTO default_rooms(name,room_id) VALUES(?,?)")
      .run(name, id);
    return id;
  }
  subscribe(userId: string, channel: ChatChannel) {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO chat_reads(user_id,channel,through_seq) VALUES(?,?,COALESCE((SELECT MAX(seq) FROM chat_messages WHERE channel=?),0))",
      )
      .run(userId, channel, channel);
  }
  unread(userId: string, channel: ChatChannel): number {
    return Number(
      this.db
        .prepare(
          "SELECT COUNT(*) AS count FROM chat_messages WHERE channel=? AND user_id<>? AND seq>COALESCE((SELECT through_seq FROM chat_reads WHERE user_id=? AND channel=?),0)",
        )
        .get(channel, userId, userId, channel)!.count,
    );
  }
  page(userId: string, channel: ChatChannel, before?: number): ChatPage {
    if (before !== undefined && (!Number.isSafeInteger(before) || before < 1))
      throw new AccountError("历史消息游标无效");
    const rows = this.db
      .prepare(
        "SELECT * FROM chat_messages WHERE channel=? AND seq<? ORDER BY seq DESC LIMIT 51",
      )
      .all(channel, before ?? Number.MAX_SAFE_INTEGER) as Row[];
    return {
      channel,
      messages: rows.slice(0, 50).reverse().map(messageOf),
      hasMore: rows.length > 50,
      unread: this.unread(userId, channel),
    };
  }
  markRead(userId: string, channel: ChatChannel, through: unknown): boolean {
    if (
      typeof through !== "number" ||
      !Number.isSafeInteger(through) ||
      through < 1 ||
      !this.db
        .prepare("SELECT seq FROM chat_messages WHERE channel=? AND seq=?")
        .get(channel, through)
    )
      throw new AccountError("已读消息位置无效");
    return !!this.db
      .prepare(
        "UPDATE chat_reads SET through_seq=? WHERE user_id=? AND channel=? AND through_seq<?",
      )
      .run(through, userId, channel, through).changes;
  }
  send(
    user: User,
    channel: ChatChannel,
    clientId: unknown,
    text: unknown,
  ): { message: ChatMessage; created: boolean } {
    if (typeof clientId !== "string" || !/^[a-f0-9-]{36}$/i.test(clientId))
      throw new AccountError("消息编号无效，请重新发送");
    if (typeof text !== "string" || !text.trim() || text.length > 200)
      throw new AccountError("消息需为 1–200 字");
    const existing = this.db
      .prepare("SELECT * FROM chat_messages WHERE user_id=? AND client_id=?")
      .get(user.id, clientId) as Row | undefined;
    if (existing) {
      if (existing.channel !== channel || existing.text !== text.trim())
        throw new AccountError("消息编号已被使用，请重新编辑后发送");
      return { message: messageOf(existing), created: false };
    }
    const last = this.db
      .prepare(
        "SELECT MAX(created_at) AS time FROM chat_messages WHERE user_id=?",
      )
      .get(user.id)!;
    if (last.time !== null && this.now() - Number(last.time) < 800)
      throw new AccountError("发送太快，请稍后点击重试", 429);
    const row = this.db
      .prepare(
        "INSERT INTO chat_messages(id,client_id,channel,user_id,name,text,created_at) VALUES(?,?,?,?,?,?,?) RETURNING *",
      )
      .get(
        randomUUID(),
        clientId,
        channel,
        user.id,
        user.name,
        text.trim(),
        this.now(),
      ) as Row;
    return { message: messageOf(row), created: true };
  }
}

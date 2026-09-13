import { randomUUID } from "node:crypto";
import { newBoard, placeStone, isWin } from "../shared/gomoku.ts";
import type {
  Room,
  User,
  Player,
  Message,
  Snapshot,
} from "../shared/protocol.ts";
import type { Accounts } from "./accounts.ts";

function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export class Hall {
  rooms: Room[] = Array.from({ length: 12 }, (_, i) => ({
    id: String(1001 + i),
    name: `五子棋 ${String(i + 1).padStart(2, "0")} 桌`,
    game: "gomoku",
    seats: [null, null],
    watchers: [],
    match: null,
  }));
  players = new Map<string, Player>();
  messages: Message[] = [];
  lastChat = new Map<string, number>();
  constructor(private accounts: Accounts) {
    this.system("欢迎进入游戏大厅。请点击游戏桌入座，双方准备后开始对局。");
  }
  system(text: string) {
    this.messages.push({
      id: randomUUID(),
      userId: null,
      name: "大厅广播",
      text,
      time: Date.now(),
    });
    this.trimChat();
  }
  trimChat() {
    this.messages = this.messages.slice(-80);
  }
  connect(user: User) {
    const previous = this.players.get(user.id);
    this.players.set(user.id, {
      ...user,
      online: true,
      roomId: previous?.roomId ?? null,
    });
  }
  offline(id: string) {
    const player = this.players.get(id);
    if (player) player.online = false;
  }
  remove(id: string) {
    this.leave(id, "对方离线超过 30 秒");
    this.players.delete(id);
    this.lastChat.delete(id);
  }
  snapshot(user: User): Snapshot {
    return {
      type: "snapshot",
      me: this.accounts.get(user.id) ?? user,
      players: [...this.players.values()],
      rooms: this.rooms,
      messages: this.messages,
      roomId: this.players.get(user.id)?.roomId ?? null,
    };
  }
  room(id: string): Room {
    const room = this.rooms.find((r) => r.id === this.players.get(id)?.roomId);
    requireThat(room, "请先进入一个房间");
    return room;
  }
  seat(room: Room, id: string) {
    return room.seats.findIndex((s) => s?.userId === id);
  }
  finish(room: Room, winner: 1 | 2 | "draw", reason: string) {
    const match = room.match;
    if (!match || match.status !== "playing") return;
    const [black, white] = room.seats;
    requireThat(black && white, "对局席位异常");
    this.accounts.result(
      match.id,
      black.userId,
      white.userId,
      winner === "draw" ? null : room.seats[winner - 1]!.userId,
      reason,
    );
    match.status = "finished";
    match.winner = winner;
    match.reason = reason;
    for (const s of room.seats)
      if (s) {
        s.ready = false;
        const p = this.players.get(s.userId),
          fresh = this.accounts.get(s.userId);
        if (p && fresh) Object.assign(p, fresh);
      }
  }
  leave(id: string, reason = "对方离开房间") {
    const player = this.players.get(id);
    if (!player?.roomId) return;
    const room = this.room(id),
      seat = this.seat(room, id);
    if (seat >= 0) {
      if (room.match?.status === "playing")
        this.finish(room, seat === 0 ? 2 : 1, reason);
      room.seats[seat] = null;
      for (const s of room.seats) if (s) s.ready = false;
    }
    room.watchers = room.watchers.filter((p) => p !== id);
    player.roomId = null;
  }
  dispatch(userId: string, input: unknown) {
    requireThat(
      input && typeof input === "object" && !Array.isArray(input),
      "消息格式不正确",
    );
    const command = input as Record<string, unknown>;
    const player = this.players.get(userId);
    requireThat(player?.online, "请重新连接大厅");
    if (command.type === "chat") {
      requireThat(
        typeof command.text === "string" &&
          command.text.trim().length > 0 &&
          command.text.length <= 200,
        "消息需为 1–200 字",
      );
      requireThat(
        Date.now() - (this.lastChat.get(userId) ?? 0) >= 800,
        "说慢一点，每秒最多一条消息",
      );
      this.lastChat.set(userId, Date.now());
      this.messages.push({
        id: randomUUID(),
        userId,
        name: player.name,
        text: command.text.trim(),
        time: Date.now(),
      });
      this.trimChat();
      return;
    }
    if (command.type === "create") {
      requireThat(command.game === "gomoku", "这款游戏还在筹备中");
      requireThat(
        typeof command.name === "string" &&
          command.name.trim().length >= 2 &&
          command.name.trim().length <= 16,
        "房间名需为 2–16 字",
      );
      requireThat(this.rooms.length < 30, "房间已达上限，请使用现有房间");
      requireThat(
        !player.roomId ||
          this.room(userId).match?.status !== "playing" ||
          this.seat(this.room(userId), userId) < 0,
        "请先完成当前对局",
      );
      const room: Room = {
        id: String(1001 + this.rooms.length),
        name: command.name.trim(),
        game: "gomoku",
        seats: [null, null],
        watchers: [],
        match: null,
      };
      this.rooms.push(room);
      this.leave(userId);
      player.roomId = room.id;
      room.watchers.push(userId);
      return;
    }
    if (command.type === "join") {
      const room = this.rooms.find((r) => r.id === command.roomId);
      requireThat(room, "房间不存在");
      if (player.roomId === room.id) return;
      requireThat(
        !player.roomId ||
          this.room(userId).match?.status !== "playing" ||
          this.seat(this.room(userId), userId) < 0,
        "请先完成当前对局，或认输后换桌",
      );
      requireThat(room.watchers.length < 20, "观战席已满");
      this.leave(userId);
      player.roomId = room.id;
      room.watchers.push(userId);
      return;
    }
    if (command.type === "leave") {
      this.leave(userId);
      return;
    }
    const room = this.room(userId),
      seat = this.seat(room, userId);
    if (command.type === "sit") {
      requireThat(command.seat === 0 || command.seat === 1, "席位不存在");
      requireThat(room.match?.status !== "playing", "这桌正在对局，可以先观战");
      requireThat(!room.seats[command.seat], "这个座位已经有人了");
      if (seat >= 0) room.seats[seat] = null;
      for (const s of room.seats) if (s) s.ready = false;
      room.match = null;
      room.seats[command.seat] = { userId, ready: false };
      room.watchers = room.watchers.filter((id) => id !== userId);
      return;
    }
    requireThat(seat >= 0, "观战中，请先入座");
    if (command.type === "stand") {
      requireThat(room.match?.status !== "playing", "对局中请先认输");
      room.seats[seat] = null;
      room.match = null;
      room.watchers.push(userId);
      for (const s of room.seats) if (s) s.ready = false;
      return;
    }
    if (command.type === "ready") {
      requireThat(room.match?.status !== "playing", "对局已经开始");
      room.seats[seat]!.ready = !room.seats[seat]!.ready;
      if (
        room.seats.every((s) => s?.ready && this.players.get(s.userId)?.online)
      ) {
        room.match = {
          id: randomUUID(),
          board: newBoard(),
          turn: 1,
          lastMove: null,
          status: "playing",
          winner: null,
          reason: null,
        };
      }
      return;
    }
    requireThat(room.match?.status === "playing", "当前没有进行中的对局");
    if (command.type === "resign") {
      this.finish(room, seat === 0 ? 2 : 1, "对方认输");
      return;
    }
    requireThat(command.type === "move", "未知操作");
    requireThat(room.match.id === command.matchId, "棋局已更新，请重新落子");
    requireThat(
      room.seats.every((s) => s && this.players.get(s.userId)?.online),
      "对方暂时离线，等待重新连接",
    );
    requireThat(room.match.turn === seat + 1, "还没轮到你落子");
    requireThat(typeof command.index === "number", "落子位置不正确");
    const board = placeStone(room.match.board, command.index, room.match.turn);
    requireThat(board, "这里不能落子");
    room.match.board = board;
    room.match.lastMove = command.index;
    if (isWin(board, command.index))
      this.finish(room, room.match.turn, "五子连珠");
    else if (board.every(Boolean)) this.finish(room, "draw", "棋盘已满");
    else room.match.turn = room.match.turn === 1 ? 2 : 1;
  }
}

import {
  createMahjong,
  shuffleMahjong,
  mahjongView,
  advanceMahjong,
  finishMahjong,
  type MahjongState,
  type MahjongSeat,
  type MahjongAction,
} from "../shared/mahjong.ts";
import { randomUUID, randomInt } from "node:crypto";
import { newBoard, placeStone, isWin } from "../shared/gomoku.ts";
import type {
  Room as PublicRoom,
  GomokuRoom,
  XiangqiRoom,
  DoudizhuRoom,
  MahjongRoom,
  User,
  Player,
  Message,
  Snapshot,
} from "../shared/protocol.ts";
import type { Accounts } from "./accounts.ts";
import { ChatStore, channelOf } from "./chat.ts";
import { AccountError } from "./account-errors.ts";
import {
  createXiangqi,
  advanceXiangqi,
  finishXiangqi,
  type XiangqiState,
  type XiangqiSide,
} from "../shared/xiangqi.ts";
import {
  createDoudizhu,
  shuffleDeck,
  doudizhuView,
  advanceDoudizhu,
  finishDoudizhu,
  type DoudizhuState,
  type CardSeat,
  type CardAction,
} from "../shared/doudizhu.ts";

type Room = PublicRoom<DoudizhuState, MahjongState>;
const dealCards = () => shuffleDeck(randomInt);

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
  chat: ChatStore;
  constructor(
    private accounts: Accounts,
    now = () => Date.now(),
  ) {
    this.chat = new ChatStore(accounts.db, now);
    for (let i = 1; i <= 6; i++)
      this.rooms.push({
        id: this.chat.defaultRoomId(`doudizhu-${i}`),
        name: `斗地主 ${String(i).padStart(2, "0")} 桌`,
        game: "doudizhu",
        seats: [null, null, null],
        watchers: [],
        match: null,
      });
    for (let i = 1; i <= 6; i++)
      this.rooms.push({
        id: this.chat.defaultRoomId(`mahjong-${i}`),
        name: `麻将 ${String(i).padStart(2, "0")} 桌`,
        game: "mahjong",
        seats: [null, null, null, null],
        watchers: [],
        match: null,
      });
    this.system("欢迎进入游戏大厅。请点击游戏桌入座，全员准备后开始对局。");
    for (let i = 1; i <= 6; i++)
      this.rooms.push({
        id: this.chat.defaultRoomId(`xiangqi-${i}`),
        name: `象棋 ${String(i).padStart(2, "0")} 桌`,
        game: "xiangqi",
        seats: [null, null],
        watchers: [],
        match: null,
      });
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
    this.chat.subscribe(user.id, "hall");
  }
  offline(id: string) {
    const player = this.players.get(id);
    if (player) player.online = false;
  }
  refreshUser(id: string) {
    const player = this.players.get(id),
      user = this.accounts.get(id);
    if (player && user) Object.assign(player, user);
  }
  isPlaying(id: string): boolean {
    const room = this.rooms.find((r) => r.seats.some((s) => s?.userId === id));
    return room?.match?.status === "playing";
  }
  forgetUser(id: string) {
    this.remove(id);
    this.messages = this.messages.filter((message) => message.userId !== id);
  }
  remove(id: string) {
    this.leave(id, "对方离线超过 30 秒");
    this.players.delete(id);
  }
  snapshot(user: User): Snapshot {
    return {
      type: "snapshot",
      me: this.accounts.get(user.id) ?? user,
      players: [...this.players.values()],
      rooms: this.rooms.map((room) =>
        room.game === "doudizhu"
          ? {
              ...room,
              match: room.match
                ? doudizhuView(room.match, this.seat(room, user.id))
                : null,
            }
          : room.game === "mahjong"
            ? {
                ...room,
                match: room.match
                  ? mahjongView(room.match, this.seat(room, user.id))
                  : null,
              }
            : room,
      ),
      messages: this.messages,
      chat: {
        revision: this.chat.revision,
        hall: this.chat.page(user.id, "hall"),
        room: this.players.get(user.id)?.roomId
          ? this.chat.page(user.id, `room:${this.players.get(user.id)!.roomId}`)
          : null,
      },
      roomId: this.players.get(user.id)?.roomId ?? null,
    };
  }
  room(id: string): Room {
    const room = this.rooms.find((r) => r.id === this.players.get(id)?.roomId);
    requireThat(room, "请先进入一个房间");
    return room;
  }
  chatChannel(userId: string, value: unknown) {
    const channel = channelOf(value),
      player = this.players.get(userId);
    if (!player?.online)
      throw new AccountError("请先连接大厅后再使用聊天", 403);
    if (channel !== "hall" && channel !== `room:${player.roomId}`)
      throw new AccountError("只能访问当前所在房间的聊天", 403);
    return channel;
  }
  seat(room: Room, id: string) {
    return room.seats.findIndex((s) => s?.userId === id);
  }
  finish(room: GomokuRoom, winner: 1 | 2 | "draw", reason: string) {
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
  finishCards(room: DoudizhuRoom<DoudizhuState>, finished: DoudizhuState) {
    requireThat(room.seats.every(Boolean), "对局席位异常");
    this.accounts.cardResult(
      finished.id,
      room.seats.map((seat, i) => ({
        userId: seat!.userId,
        role: i === finished.landlord ? "landlord" : "farmer",
        won:
          finished.winner !== null &&
          (finished.winner === "landlord"
            ? i === finished.landlord
            : i !== finished.landlord),
        score: finished.scores[i],
      })),
      finished.winner,
      finished.reason!,
      finished.bid,
      finished.multiplier,
      finished.spring,
    );
    room.match = finished;
    for (const seat of room.seats)
      if (seat) {
        seat.ready = false;
        this.refreshUser(seat.userId);
      }
  }
  finishTiles(room: MahjongRoom<MahjongState>, finished: MahjongState) {
    requireThat(room.seats.every(Boolean) && finished.result, "对局席位异常");
    const result = finished.result;
    this.accounts.mahjongResult(
      finished.id,
      room.seats.map((seat, i) => ({
        userId: seat!.userId,
        won: result.winner === i,
        lost:
          result.kind === "self-draw"
            ? i !== result.winner
            : result.loser === i,
        score: finished.scores[i],
      })),
      result,
    );
    room.match = finished;
    for (const seat of room.seats)
      if (seat) {
        seat.ready = false;
        this.refreshUser(seat.userId);
      }
  }
  forfeit(room: Room, seat: number, reason: string) {
    if (room.match?.status !== "playing") return;
    if (room.game === "gomoku") this.finish(room, seat === 0 ? 2 : 1, reason);
    else if (room.game === "xiangqi")
      this.finishChess(
        room,
        finishXiangqi(room.match!, seat === 0 ? 2 : 1, reason),
      );
    else if (room.game === "mahjong")
      this.finishTiles(
        room,
        finishMahjong(room.match!, {
          kind: "forfeit",
          winner: null,
          loser: seat as MahjongSeat,
          reason: `${reason}，本局中止；退出者记负，其他人不计胜负`,
        }),
      );
    else {
      const state = room.match!;
      this.finishCards(
        room,
        finishDoudizhu(
          state,
          state.phase === "bidding"
            ? null
            : seat === state.landlord
              ? "farmers"
              : "landlord",
          state.phase === "bidding"
            ? "叫分阶段有人退出，本局取消，不计战绩"
            : reason,
        ),
      );
    }
  }
  leave(id: string, reason = "对方离开房间") {
    const player = this.players.get(id);
    if (!player?.roomId) return;
    const room = this.room(id),
      seat = this.seat(room, id);
    if (seat >= 0) {
      this.forfeit(room, seat, reason);
      room.seats[seat] = null;
      for (const s of room.seats) if (s) s.ready = false;
    }
    room.watchers = room.watchers.filter((p) => p !== id);
    player.roomId = null;
  }
  finishChess(room: XiangqiRoom, finished: XiangqiState) {
    requireThat(room.seats[0] && room.seats[1], "对局席位异常");
    this.accounts.result(
      finished.id,
      room.seats[0].userId,
      room.seats[1].userId,
      finished.winner === "draw"
        ? null
        : room.seats[finished.winner! - 1]!.userId,
      finished.reason!,
      "xiangqi",
    );
    room.match = finished;
    for (const seat of room.seats)
      if (seat) {
        seat.ready = false;
        this.refreshUser(seat.userId);
      }
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
      const channel = this.chatChannel(userId, command.channel);
      return this.chat.send(
        this.accounts.get(userId)!,
        channel,
        command.clientId,
        command.text,
      );
    }
    if (command.type === "create") {
      requireThat(
        command.game === "gomoku" ||
          command.game === "doudizhu" ||
          command.game === "xiangqi" ||
          command.game === "mahjong",
        "这款游戏还在筹备中",
      );
      requireThat(
        typeof command.name === "string" &&
          command.name.trim().length >= 2 &&
          command.name.trim().length <= 16,
        "房间名需为 2–16 字",
      );
      requireThat(this.rooms.length < 60, "房间已达上限，请使用现有房间");
      requireThat(
        !player.roomId ||
          this.room(userId).match?.status !== "playing" ||
          this.seat(this.room(userId), userId) < 0,
        "请先完成当前对局",
      );
      const room: Room = {
        id: this.chat.allocateRoomId(),
        name: command.name.trim(),
        ...(command.game === "mahjong"
          ? {
              game: "mahjong" as const,
              seats: [null, null, null, null] as [null, null, null, null],
            }
          : command.game !== "doudizhu"
            ? { game: command.game, seats: [null, null] as [null, null] }
            : {
                game: "doudizhu" as const,
                seats: [null, null, null] as [null, null, null],
              }),
        watchers: [],
        match: null,
      };
      this.rooms.push(room);
      this.leave(userId);
      player.roomId = room.id;
      room.watchers.push(userId);
      this.chat.subscribe(userId, `room:${room.id}`);
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
      this.chat.subscribe(userId, `room:${room.id}`);
      return;
    }
    if (command.type === "leave") {
      this.leave(userId);
      return;
    }
    const room = this.room(userId),
      seat = this.seat(room, userId);
    if (command.type === "sit") {
      requireThat(
        typeof command.seat === "number" &&
          Number.isInteger(command.seat) &&
          command.seat >= 0 &&
          command.seat < room.seats.length,
        "席位不存在",
      );
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
        if (room.game === "doudizhu")
          room.match = createDoudizhu(
            randomUUID(),
            dealCards(),
            randomInt(3) as CardSeat,
          );
        else if (room.game === "mahjong")
          room.match = createMahjong(randomUUID(), shuffleMahjong(randomInt));
        else if (room.game === "xiangqi")
          room.match = createXiangqi(randomUUID());
        else
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
      this.forfeit(room, seat, "有玩家认输");
      return;
    }
    if (room.game === "xiangqi") {
      const state = room.match!;
      requireThat(
        state.id === command.matchId && state.revision === command.revision,
        "棋局已更新，请根据当前局面重新操作",
      );
      requireThat(
        room.seats.every((s) => s && this.players.get(s.userId)?.online),
        "对方暂时离线，等待重新连接",
      );
      const side = (seat + 1) as XiangqiSide;
      if (command.type === "xq:draw") {
        requireThat(state.drawOffer === null, "已有待处理的和棋请求");
        room.match = {
          ...state,
          drawOffer: side,
          revision: state.revision + 1,
        };
      } else if (command.type === "xq:draw-response") {
        requireThat(
          state.drawOffer !== null &&
            state.drawOffer !== side &&
            typeof command.accept === "boolean",
          "没有可回应的和棋请求",
        );
        if (command.accept)
          this.finishChess(room, finishXiangqi(state, "draw", "双方同意和棋"));
        else
          room.match = {
            ...state,
            drawOffer: null,
            revision: state.revision + 1,
          };
      } else {
        requireThat(command.type === "xq:move", "这桌只接受中国象棋操作");
        requireThat(
          typeof command.from === "number" && typeof command.to === "number",
          "走棋位置不正确",
        );
        const next = advanceXiangqi(state, side, {
          from: command.from,
          to: command.to,
        });
        if (next.status === "finished") this.finishChess(room, next);
        else room.match = next;
      }
      return;
    }
    if (room.game === "mahjong") {
      const state = room.match!;
      requireThat(command.type === "mj:action", "这桌只接受中国麻将操作");
      // Different players can answer the same discard concurrently. The claim
      // boundary prevents an old response being applied to a subsequent discard.
      const responding =
        command.action &&
        typeof command.action === "object" &&
        "type" in command.action &&
        command.action.type === "claim";
      const sameClaim =
        responding &&
        state.claim &&
        typeof command.revision === "number" &&
        Number.isInteger(command.revision) &&
        command.revision >= state.claim.openedAt &&
        command.revision <= state.revision;
      requireThat(
        state.id === command.matchId &&
          (state.revision === command.revision || sameClaim),
        "牌局已更新，请根据当前手牌重新操作",
      );
      requireThat(
        room.seats.every((s) => s && this.players.get(s.userId)?.online),
        "有玩家暂时离线，等待重新连接",
      );
      requireThat(
        command.action &&
          typeof command.action === "object" &&
          !Array.isArray(command.action),
        "麻将操作格式不正确",
      );
      const next = advanceMahjong(
        state,
        seat as MahjongSeat,
        command.action as MahjongAction,
      );
      if (next.status === "finished") this.finishTiles(room, next);
      else room.match = next;
      return;
    }
    if (room.game === "doudizhu") {
      const state = room.match!;
      requireThat(
        ["ddz:bid", "ddz:play", "ddz:pass"].includes(String(command.type)),
        "这桌只接受斗地主操作",
      );
      requireThat(
        state.id === command.matchId && state.revision === command.revision,
        "牌局已更新，请根据当前手牌重新操作",
      );
      requireThat(
        room.seats.every((s) => s && this.players.get(s.userId)?.online),
        "有玩家暂时离线，等待重新连接",
      );
      let action: CardAction;
      if (command.type === "ddz:bid") {
        requireThat(typeof command.score === "number", "叫分无效");
        action = { type: "bid", score: command.score };
      } else if (command.type === "ddz:play") {
        requireThat(Array.isArray(command.cards), "请选择要出的手牌");
        action = { type: "play", cards: command.cards };
      } else action = { type: "pass" };
      const next = advanceDoudizhu(state, seat as CardSeat, action, dealCards);
      if (next.status === "finished") this.finishCards(room, next);
      else room.match = next;
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

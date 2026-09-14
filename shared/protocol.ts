import type { MahjongAction, MahjongView } from "./mahjong.ts";
import type { Board } from "./gomoku.ts";
import type { DoudizhuView } from "./doudizhu.ts";
import type { XiangqiState } from "./xiangqi.ts";
import type { ChatChannel, ChatMessage, ChatSnapshot } from "./chat.ts";
export type GameId = "gomoku" | "xiangqi" | "doudizhu" | "mahjong";
export const games: {
  id: GameId;
  name: string;
  english: string;
  description: string;
  available: boolean;
  symbol: string;
}[] = [
  {
    id: "gomoku",
    name: "五子棋",
    english: "GOMOKU",
    description: "黑白之间，以棋会友",
    available: true,
    symbol: "●",
  },
  {
    id: "xiangqi",
    name: "中国象棋",
    english: "CHINESE CHESS",
    description: "楚河汉界，将遇良才",
    available: true,
    symbol: "帥",
  },
  {
    id: "doudizhu",
    name: "斗地主",
    english: "FIGHT THE LANDLORD",
    description: "三人一桌，欢乐加倍",
    available: true,
    symbol: "♠",
  },
  {
    id: "mahjong",
    name: "中国麻将",
    english: "MAHJONG",
    description: "东西南北，老友相聚",
    available: true,
    symbol: "發",
  },
];
export type User = {
  id: string;
  name: string;
  guest: boolean;
  wins: number;
  losses: number;
  avatar: number;
};
export type Player = User & { online: boolean; roomId: string | null };
export type Seat = { userId: string; ready: boolean } | null;
export type Match = {
  id: string;
  board: Board;
  turn: 1 | 2;
  lastMove: number | null;
  status: "playing" | "finished";
  winner: 1 | 2 | "draw" | null;
  reason: string | null;
};
type RoomBase = {
  id: string;
  name: string;
  watchers: string[];
};
export type GomokuRoom = RoomBase & {
  game: "gomoku";
  seats: [Seat, Seat];
  match: Match | null;
};
export type DoudizhuRoom<T = DoudizhuView> = RoomBase & {
  game: "doudizhu";
  seats: [Seat, Seat, Seat];
  match: T | null;
};
export type XiangqiRoom = RoomBase & {
  game: "xiangqi";
  seats: [Seat, Seat];
  match: XiangqiState | null;
};
export type MahjongRoom<T = MahjongView> = RoomBase & {
  game: "mahjong";
  seats: [Seat, Seat, Seat, Seat];
  match: T | null;
};
export type Room<T = DoudizhuView, M = MahjongView> =
  GomokuRoom | XiangqiRoom | DoudizhuRoom<T> | MahjongRoom<M>;
export type Message = {
  id: string;
  name: string;
  userId: string | null;
  text: string;
  time: number;
};
export type Snapshot = {
  type: "snapshot";
  me: User;
  players: Player[];
  rooms: Room[];
  messages: Message[];
  chat: ChatSnapshot;
  roomId: string | null;
};
export type ServerEvent =
  | Snapshot
  | { type: "error"; message: string }
  | { type: "chat:ack"; clientId: string; message: ChatMessage }
  | { type: "chat:error"; clientId: string; message: string };
export type Command =
  | { type: "join"; roomId: string }
  | { type: "leave" }
  | { type: "sit"; seat: 0 | 1 | 2 | 3 }
  | { type: "stand" }
  | { type: "ready" }
  | { type: "move"; index: number; matchId: string }
  | {
      type: "xq:move";
      from: number;
      to: number;
      matchId: string;
      revision: number;
    }
  | { type: "xq:draw"; matchId: string; revision: number }
  | {
      type: "xq:draw-response";
      accept: boolean;
      matchId: string;
      revision: number;
    }
  | { type: "ddz:bid"; score: number; matchId: string; revision: number }
  | { type: "ddz:play"; cards: number[]; matchId: string; revision: number }
  | { type: "ddz:pass"; matchId: string; revision: number }
  | {
      type: "mj:action";
      action: MahjongAction;
      matchId: string;
      revision: number;
    }
  | { type: "resign" }
  | { type: "chat"; text: string; channel: ChatChannel; clientId: string }
  | { type: "create"; name: string; game: GameId };

import type { Board } from "./gomoku.ts";
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
    available: false,
    symbol: "帥",
  },
  {
    id: "doudizhu",
    name: "斗地主",
    english: "FIGHT THE LANDLORD",
    description: "三人一桌，欢乐加倍",
    available: false,
    symbol: "♠",
  },
  {
    id: "mahjong",
    name: "中国麻将",
    english: "MAHJONG",
    description: "东西南北，老友相聚",
    available: false,
    symbol: "發",
  },
];
export type User = {
  id: string;
  name: string;
  guest: boolean;
  wins: number;
  losses: number;
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
export type Room = {
  id: string;
  name: string;
  game: GameId;
  seats: [Seat, Seat];
  watchers: string[];
  match: Match | null;
};
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
  roomId: string | null;
};
export type ServerEvent = Snapshot | { type: "error"; message: string };
export type Command =
  | { type: "join"; roomId: string }
  | { type: "leave" }
  | { type: "sit"; seat: 0 | 1 }
  | { type: "stand" }
  | { type: "ready" }
  | { type: "move"; index: number; matchId: string }
  | { type: "resign" }
  | { type: "chat"; text: string }
  | { type: "create"; name: string; game: GameId };

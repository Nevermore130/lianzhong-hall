import {
  newBoard,
  placeStone,
  chooseComputerMove,
  type Board,
} from "../../../shared/gomoku";
import {
  createXiangqi,
  advanceXiangqi,
  legalMoves,
  type XiangqiState,
} from "../../../shared/xiangqi";
import {
  createDoudizhu,
  advanceDoudizhu,
  doudizhuView,
  legalPlays,
  computerAction,
  classify,
  type DoudizhuState,
} from "../../../shared/doudizhu";
import {
  createMahjong,
  advanceMahjong,
  mahjongView,
  mahjongComputerAction,
  suggestMahjongDiscard,
  type MahjongState,
  type MahjongSeat,
} from "../../../shared/mahjong";
import {
  games,
  type GameId,
  type Room,
  type Snapshot,
  type GomokuRoom,
  type Match,
} from "../../../shared/protocol";

export const FPS = 30,
  DURATION = 34,
  FRAMES = FPS * DURATION;
export const viewer = {
  id: "demo-viewer",
  name: "体验玩家",
  guest: true,
  wins: 0,
  losses: 0,
  avatar: 0,
};
export const players = [
  viewer,
  { ...viewer, id: "demo-friend", name: "棋友小梅", avatar: 1 },
  { ...viewer, id: "demo-chen", name: "棋友老陈", avatar: 2 },
  { ...viewer, id: "demo-fang", name: "棋友阿芳", avatar: 3 },
];
export const practicePlayers = players.map((p, i) => ({
  name: i === 0 ? "你" : ["", "电脑 · 小梅", "电脑 · 老陈", "电脑 · 阿芳"][i],
  avatar: p.avatar,
  online: true,
  ready: true,
}));
export const rooms: Room[] = games.flatMap((g) =>
  Array.from(
    { length: 6 },
    (_, i) =>
      ({
        id: g.id + "-" + (i + 1),
        name:
          (g.id === "mahjong" ? "麻将" : g.name) +
          " " +
          String(i + 1).padStart(2, "0") +
          " 桌",
        game: g.id,
        watchers: [],
        seats:
          g.id === "mahjong"
            ? [null, null, null, null]
            : g.id === "doudizhu"
              ? [null, null, null]
              : [null, null],
        match: null,
      }) as Room,
  ),
);
export function snapshot(room: GomokuRoom | null = null): Snapshot {
  return {
    type: "snapshot",
    me: viewer,
    players: players.map((p) => ({
      ...p,
      online: true,
      roomId: room?.seats.some((s) => s?.userId === p.id) ? room.id : null,
    })),
    rooms: room ? rooms.map((r) => (r.id === room.id ? room : r)) : rooms,
    messages: [],
    roomId: room?.id ?? null,
    chat: {
      revision: 0,
      hall: { channel: "hall", messages: [], hasMore: false, unread: 0 },
      room: null,
    },
  };
}
type Moment<T> = { at: number; value: T };
export function atTime<T>(moments: Moment<T>[], t: number): T {
  return (moments.findLast((m) => m.at <= t) ?? moments[0]).value;
}

// Every board change goes through the same engine used by the live game.
let board = newBoard();
export const gomoku: Moment<{
  board: Board;
  last: number | null;
  turn: 1 | 2;
}>[] = [{ at: 0, value: { board, last: null, turn: 1 } }];
for (const [at, index] of [
  [5.2, 112],
  [6.6, 113],
  [8.0, 128],
] as const) {
  const next = placeStone(board, index, 1);
  if (!next) throw Error("Illegal demo move");
  board = next;
  gomoku.push({ at, value: { board, last: index, turn: 2 } });
  const reply = chooseComputerMove(board)!;
  board = placeStone(board, reply, 2)!;
  gomoku.push({ at: at + 0.7, value: { board, last: reply, turn: 1 } });
}
export function gomokuRoom(t: number): GomokuRoom {
  const s = atTime(gomoku, t);
  const match: Match | null =
    t < 4.55
      ? null
      : {
          id: "demo-gomoku",
          board: s.board,
          turn: s.turn,
          lastMove: s.last,
          status: "playing",
          winner: null,
          reason: null,
        };
  return {
    id: "gomoku-1",
    name: "五子棋 01 桌",
    game: "gomoku",
    watchers: [],
    seats: [
      t < 3.1 ? null : { userId: viewer.id, ready: t >= 4.1 },
      t < 3.7 ? null : { userId: players[1].id, ready: t >= 4.55 },
    ],
    match,
  };
}
export const xiangqi: Moment<XiangqiState>[] = [
  { at: 0, value: createXiangqi("demo-xiangqi") },
];
const x1 = advanceXiangqi(xiangqi[0].value, 1, { from: 70, to: 67 }); // 炮二平五
xiangqi.push({ at: 13.1, value: x1 });
const x2 = advanceXiangqi(x1, 2, { from: 1, to: 20 });
xiangqi.push({ at: 14.1, value: x2 });
const x3 = advanceXiangqi(x2, 1, { from: 82, to: 65 });
xiangqi.push({ at: 15.65, value: x3 });
const x4 = advanceXiangqi(
  x3,
  2,
  legalMoves(x3.board, 2).find((m) => m.from === 27 && m.to === 36)!,
);
xiangqi.push({ at: 16.3, value: x4 });

const initialHand = [
    52, 53, 40, 44, 48, 32, 36, 28, 24, 20, 16, 12, 8, 4, 0, 1, 5,
  ],
  bottom = [45, 49, 41];
const remaining = Array.from({ length: 54 }, (_, i) => i).filter(
  (c) => !initialHand.includes(c) && !bottom.includes(c),
);
const deck = [...initialHand, ...remaining, ...bottom];
let ddz = createDoudizhu("demo-doudizhu", deck);
export const doudizhu: Moment<DoudizhuState>[] = [{ at: 0, value: ddz }];
ddz = advanceDoudizhu(ddz, 0, { type: "bid", score: 3 }, () => deck);
doudizhu.push({ at: 18.8, value: ddz });
export const selectedCards = legalPlays(ddz.hands[0], null)[0];
ddz = advanceDoudizhu(
  ddz,
  0,
  { type: "play", cards: selectedCards },
  () => deck,
);
doudizhu.push({ at: 21.6, value: ddz });
for (const at of [22.4, 23.15]) {
  ddz = advanceDoudizhu(
    ddz,
    ddz.turn,
    computerAction(doudizhuView(ddz, ddz.turn), ddz.turn),
    () => deck,
  );
  doudizhu.push({ at, value: ddz });
}
if (!classify(selectedCards)) throw Error("Invalid demo selection");

// A repeatable, fully legal deal chosen to demonstrate a real 碰 response.
const used = new Set<number>();
const reserve = (types: number[]) =>
  types.map((type) => {
    const tile = Array.from({ length: 4 }, (_, i) => type * 4 + i).find(
      (t) => !used.has(t),
    );
    if (tile === undefined) throw Error("Too many tiles");
    used.add(tile);
    return tile;
  });
const hands = [
  reserve([0, 1, 3, 9, 10, 12, 18, 19, 20, 27, 29, 31, 31]),
  [],
  [],
  reserve([31]),
] as [number[], number[], number[], number[]];
let seed = 98;
let stock = Array.from({ length: 136 }, (_, i) => i).filter(
  (t) => !used.has(t),
);
for (let i = stock.length - 1; i > 0; i--) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const j = seed % (i + 1);
  [stock[i], stock[j]] = [stock[j], stock[i]];
}
for (let seat = 0; seat < 4; seat++)
  while (hands[seat].length < (seat === 3 ? 14 : 13))
    hands[seat].push(stock.shift()!);
const tiles: number[] = [];
for (let r = 0; r < 13; r++)
  for (const seat of [3, 0, 1, 2]) tiles.push(hands[seat][r]);
tiles.push(hands[3][13], ...stock);
let mj = createMahjong("demo-mahjong", tiles, 3);
export const mahjong: Moment<MahjongState>[] = [{ at: 0, value: mj }];
mj = advanceMahjong(mj, 3, { type: "discard", tile: hands[3][0] });
if (mj.claim)
  for (const seat of [...mj.claim.eligible])
    if (seat !== 0 && !mj.claim?.replies[seat])
      mj = advanceMahjong(mj, seat, { type: "claim", choice: "pass" });
mahjong.push({ at: 26.2, value: mj });
const peng = mahjongView(mj, 0).options.find((o) => o.choice === "peng");
if (!peng) throw Error("The staged deal must offer peng");
mj = advanceMahjong(mj, 0, { type: "claim", ...peng });
mahjong.push({ at: 27.65, value: mj });
export const discardedTile = suggestMahjongDiscard(mj.hands[0]);
mj = advanceMahjong(mj, 0, { type: "discard", tile: discardedTile });
mahjong.push({ at: 29.1, value: mj });
for (const at of [29.9, 30.7, 31.3]) {
  const seat =
    mj.phase === "claim"
      ? mj.claim!.eligible.find((s) => !mj.claim!.replies[s])!
      : mj.turn;
  const action = mahjongComputerAction(mahjongView(mj, seat), seat);
  if (!action) break;
  mj = advanceMahjong(mj, seat as MahjongSeat, action);
  mahjong.push({ at, value: mj });
}

export function screen(t: number): {
  game: GameId | "all";
  mode: "hall" | "gomoku" | "xiangqi" | "doudizhu" | "mahjong";
} {
  if (t < 2.12) return { game: t < 0.8 ? "all" : "gomoku", mode: "hall" };
  if (t < 10.3) return { game: "gomoku", mode: "gomoku" };
  if (t < 11.5) return { game: t < 10.82 ? "gomoku" : "xiangqi", mode: "hall" };
  if (t < 17) return { game: "xiangqi", mode: "xiangqi" };
  if (t < 17.85)
    return { game: t < 17.32 ? "xiangqi" : "doudizhu", mode: "hall" };
  if (t < 24.1) return { game: "doudizhu", mode: "doudizhu" };
  if (t < 24.95)
    return { game: t < 24.47 ? "doudizhu" : "mahjong", mode: "hall" };
  if (t < 32.3) return { game: "mahjong", mode: "mahjong" };
  return { game: "mahjong", mode: "hall" };
}
export const captions = [
  { from: 0, to: 2.4, text: "还记得点开游戏大厅的那一刻吗？" },
  { from: 2.4, to: 4.7, text: "点棋桌 → 入座 → 准备开局" },
  { from: 4.7, to: 10.3, text: "五子棋，轮到你就落一子" },
  { from: 10.3, to: 12.2, text: "换个玩法，和电脑下一盘象棋" },
  { from: 12.2, to: 17, text: "选中棋子，绿点就是可走位置" },
  { from: 17, to: 19.5, text: "斗地主，先叫个三分" },
  { from: 19.5, to: 21.6, text: "点提示选牌，滑动看看手牌" },
  { from: 21.6, to: 24.1, text: "点出牌，等对手接招" },
  { from: 24.1, to: 26.2, text: "再来一桌新加入的中国麻将" },
  { from: 26.2, to: 27.65, text: "对手打出红中，这张可以碰" },
  { from: 27.65, to: 29.1, text: "碰牌亮出来，再选一张打出去" },
  { from: 29.1, to: 32.3, text: "碰牌、弃牌、轮转，接着打" },
  { from: 32.3, to: 34, text: "这次，你最想和谁来一局？" },
];
export type Cue = {
  at: number;
  selector: string;
  fallback: [number, number];
  click?: boolean;
};
export const cues: Cue[] = [
  { at: 0, selector: "", fallback: [350, 530] },
  {
    at: 0.76,
    selector: ".game-tabs button:nth-child(1)",
    fallback: [48, 144],
    click: true,
  },
  {
    at: 2.0,
    selector: ".scene-table:first-child .scene-table-enter",
    fallback: [114, 323],
    click: true,
  },
  {
    at: 3.02,
    selector: '[aria-label="执黑入座"]',
    fallback: [175, 157],
    click: true,
  },
  {
    at: 4.0,
    selector: ".room-actions button.primary",
    fallback: [406, 610],
    click: true,
  },
  ...[5.1, 6.5, 7.9].map((at, i) => ({
    at,
    selector: `.point[aria-label^="${["H8", "I8", "I9"][i]}"]`,
    fallback: [230 + i * 10, 380] as [number, number],
    click: true,
  })),
  { at: 9.4, selector: "", fallback: [345, 570] },
  {
    at: 10.75,
    selector: ".game-tabs button:nth-child(2)",
    fallback: [140, 144],
    click: true,
  },
  {
    at: 11.4,
    selector: '[data-tool="practice"]',
    fallback: [390, 58],
    click: true,
  },
  {
    at: 12.35,
    selector: '[data-square="H3"]',
    fallback: [336, 536],
    click: true,
  },
  {
    at: 13.0,
    selector: '[data-square="E3"]',
    fallback: [225, 536],
    click: true,
  },
  {
    at: 14.85,
    selector: '[data-square="B1"]',
    fallback: [108, 613],
    click: true,
  },
  {
    at: 15.55,
    selector: '[data-square="C3"]',
    fallback: [148, 536],
    click: true,
  },
  { at: 16.75, selector: "", fallback: [385, 640] },
  {
    at: 17.25,
    selector: ".game-tabs button:nth-child(3)",
    fallback: [230, 145],
    click: true,
  },
  {
    at: 17.75,
    selector: '[data-tool="practice"]',
    fallback: [390, 58],
    click: true,
  },
  {
    at: 18.7,
    selector: ".ddz-controls button:nth-child(4)",
    fallback: [370, 590],
    click: true,
  },
  {
    at: 19.65,
    selector: ".ddz-controls button:nth-child(2)",
    fallback: [169, 590],
    click: true,
  },
  { at: 20.1, selector: "", fallback: [330, 481] },
  { at: 20.9, selector: "", fallback: [108, 481] },
  {
    at: 21.5,
    selector: ".ddz-controls button:nth-child(4)",
    fallback: [370, 590],
    click: true,
  },
  { at: 23.3, selector: "", fallback: [329, 390] },
  {
    at: 24.4,
    selector: ".game-tabs button:nth-child(4)",
    fallback: [329, 145],
    click: true,
  },
  {
    at: 24.85,
    selector: '[data-tool="practice"]',
    fallback: [390, 58],
    click: true,
  },
  { at: 25.8, selector: "", fallback: [225, 319] },
  {
    at: 27.55,
    selector: '.mj-controls [data-choice="peng"]',
    fallback: [46, 568],
    click: true,
  },
  {
    at: 28.3,
    selector: `.mj-hand-tile[data-tile="${discardedTile}"]`,
    fallback: [347, 530],
    click: true,
  },
  {
    at: 29.0,
    selector: ".mj-controls .primary",
    fallback: [170, 590],
    click: true,
  },
  { at: 31, selector: "", fallback: [342, 520] },
  {
    at: 32.2,
    selector: '[aria-label="关闭弹窗"]',
    fallback: [417, 30],
    click: true,
  },
  {
    at: 33.5,
    selector: ".scene-table:first-child .scene-table-enter",
    fallback: [114, 323],
  },
];

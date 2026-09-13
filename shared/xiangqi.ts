export type XiangqiSide = 1 | 2; // Red at the bottom, black at the top.
export type XiangqiKind =
  "king" | "advisor" | "elephant" | "horse" | "rook" | "cannon" | "pawn";
export type XiangqiPiece = { side: XiangqiSide; kind: XiangqiKind };
export type XiangqiBoard = (XiangqiPiece | null)[];
export type XiangqiAction = { from: number; to: number };
export type XiangqiMove = XiangqiAction & {
  piece: XiangqiPiece;
  captured: XiangqiPiece | null;
  check: boolean;
  label: string;
};
export type XiangqiState = {
  id: string;
  board: XiangqiBoard;
  turn: XiangqiSide;
  revision: number;
  status: "playing" | "finished";
  winner: XiangqiSide | "draw" | null;
  reason: string | null;
  lastMove: XiangqiMove | null;
  history: XiangqiMove[];
  positions: string[];
  quietPlies: number;
  drawOffer: XiangqiSide | null;
};

export const otherSide = (side: XiangqiSide): XiangqiSide =>
  side === 1 ? 2 : 1;
export const sideName = (side: XiangqiSide) => (side === 1 ? "红方" : "黑方");
export const pieceGlyph = (p: XiangqiPiece) =>
  ({
    king: p.side === 1 ? "帥" : "將",
    advisor: p.side === 1 ? "仕" : "士",
    elephant: p.side === 1 ? "相" : "象",
    horse: "馬",
    rook: "車",
    cannon: p.side === 1 ? "炮" : "砲",
    pawn: p.side === 1 ? "兵" : "卒",
  })[p.kind];
export const squareName = (i: number) =>
  `${"ABCDEFGHI"[i % 9]}${10 - Math.floor(i / 9)}`;
const validIndex = (i: number) => Number.isInteger(i) && i >= 0 && i < 90;
const index = (x: number, y: number) => y * 9 + x;
const inside = (x: number, y: number) => x >= 0 && x < 9 && y >= 0 && y < 10;
const palace = (x: number, y: number, side: XiangqiSide) =>
  x >= 3 && x <= 5 && (side === 1 ? y >= 7 && y <= 9 : y >= 0 && y <= 2);
const home = (y: number, side: XiangqiSide) => (side === 1 ? y >= 5 : y <= 4);
const directions = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function newXiangqiBoard(): XiangqiBoard {
  const board: XiangqiBoard = Array(90).fill(null);
  const back: XiangqiKind[] = [
    "rook",
    "horse",
    "elephant",
    "advisor",
    "king",
    "advisor",
    "elephant",
    "horse",
    "rook",
  ];
  for (const side of [1, 2] as const) {
    back.forEach((kind, x) => {
      board[index(x, side === 1 ? 9 : 0)] = { side, kind };
    });
    for (const x of [1, 7])
      board[index(x, side === 1 ? 7 : 2)] = { side, kind: "cannon" };
    for (const x of [0, 2, 4, 6, 8])
      board[index(x, side === 1 ? 6 : 3)] = { side, kind: "pawn" };
  }
  return board;
}

/** Piece geometry only; used for attacks as well as legal-move generation. */
function destinations(board: XiangqiBoard, from: number): number[] {
  const p = board[from];
  if (!p) return [];
  const x = from % 9,
    y = Math.floor(from / 9),
    targets: number[] = [];
  const add = (a: number, b: number) => {
    if (inside(a, b) && board[index(a, b)]?.side !== p.side)
      targets.push(index(a, b));
  };
  if (p.kind === "rook" || p.kind === "cannon") {
    for (const [dx, dy] of directions) {
      let screen = false;
      for (let a = x + dx, b = y + dy; inside(a, b); a += dx, b += dy) {
        const target = board[index(a, b)];
        if (!screen) {
          if (!target) add(a, b);
          else if (p.kind === "rook") {
            add(a, b);
            break;
          } else screen = true;
        } else if (target) {
          add(a, b);
          break;
        }
      }
    }
  } else if (p.kind === "horse") {
    for (const [dx, dy] of [
      [2, 1],
      [2, -1],
      [-2, 1],
      [-2, -1],
      [1, 2],
      [-1, 2],
      [1, -2],
      [-1, -2],
    ]) {
      const legX = x + (Math.abs(dx) === 2 ? Math.sign(dx) : 0),
        legY = y + (Math.abs(dy) === 2 ? Math.sign(dy) : 0);
      if (inside(legX, legY) && !board[index(legX, legY)]) add(x + dx, y + dy);
    }
  } else if (p.kind === "elephant") {
    for (const dx of [-2, 2])
      for (const dy of [-2, 2]) {
        if (
          inside(x + dx, y + dy) &&
          home(y + dy, p.side) &&
          !board[index(x + dx / 2, y + dy / 2)]
        )
          add(x + dx, y + dy);
      }
  } else if (p.kind === "advisor") {
    for (const dx of [-1, 1])
      for (const dy of [-1, 1])
        if (palace(x + dx, y + dy, p.side)) add(x + dx, y + dy);
  } else if (p.kind === "king") {
    for (const [dx, dy] of directions)
      if (palace(x + dx, y + dy, p.side)) add(x + dx, y + dy);
    for (const dy of [-1, 1])
      for (let b = y + dy; inside(x, b); b += dy) {
        const target = board[index(x, b)];
        if (target) {
          if (target.kind === "king") add(x, b);
          break;
        }
      }
  } else {
    add(x, y + (p.side === 1 ? -1 : 1));
    if (!home(y, p.side)) {
      add(x - 1, y);
      add(x + 1, y);
    }
  }
  return targets;
}

export function inCheck(board: XiangqiBoard, side: XiangqiSide): boolean {
  const king = board.findIndex((p) => p?.side === side && p.kind === "king");
  return (
    king < 0 ||
    board.some(
      (p, from) =>
        p && p.side !== side && destinations(board, from).includes(king),
    )
  );
}
function movedBoard(board: XiangqiBoard, from: number, to: number) {
  const next = board.slice();
  next[to] = next[from];
  next[from] = null;
  return next;
}
export function legalDestinations(board: XiangqiBoard, from: number): number[] {
  if (!validIndex(from) || !board[from]) return [];
  const side = board[from]!.side;
  return destinations(board, from).filter(
    (to) =>
      board[to]?.kind !== "king" && !inCheck(movedBoard(board, from, to), side),
  );
}
export function legalMoves(
  board: XiangqiBoard,
  side: XiangqiSide,
): XiangqiAction[] {
  return board.flatMap((p, from) =>
    p?.side === side
      ? legalDestinations(board, from).map((to) => ({ from, to }))
      : [],
  );
}
export function positionKey(board: XiangqiBoard, turn: XiangqiSide) {
  return (
    `${turn}:` +
    board
      .map((p) =>
        p ? `${p.side}${p.kind[0]}${p.kind === "cannon" ? "c" : ""}` : "_",
      )
      .join(",")
  );
}
export function createXiangqi(
  id: string,
  board = newXiangqiBoard(),
  turn: XiangqiSide = 1,
): XiangqiState {
  return {
    id,
    board,
    turn,
    revision: 0,
    status: "playing",
    winner: null,
    reason: null,
    lastMove: null,
    history: [],
    positions: [positionKey(board, turn)],
    quietPlies: 0,
    drawOffer: null,
  };
}
export function finishXiangqi(
  state: XiangqiState,
  winner: XiangqiSide | "draw",
  reason: string,
): XiangqiState {
  if (state.status !== "playing") return state;
  return {
    ...state,
    status: "finished",
    winner,
    reason,
    drawOffer: null,
    revision: state.revision + 1,
  };
}
export function advanceXiangqi(
  state: XiangqiState,
  side: XiangqiSide,
  action: XiangqiAction,
): XiangqiState {
  if (state.status !== "playing") throw new Error("本局已经结束");
  if (state.turn !== side) throw new Error("还没轮到你走棋");
  const { from, to } = action;
  if (!validIndex(from) || !validIndex(to) || state.board[from]?.side !== side)
    throw new Error("请选择自己的棋子");
  if (!legalDestinations(state.board, from).includes(to))
    throw new Error("这步不能走，请注意蹩马腿、塞象眼与将帅安全");
  const board = movedBoard(state.board, from, to),
    turn = otherSide(side),
    check = inCheck(board, turn);
  const piece = state.board[from]!,
    captured = state.board[to];
  const move: XiangqiMove = {
    from,
    to,
    piece,
    captured,
    check,
    label: `${sideName(side)}${pieceGlyph(piece)} ${squareName(from)} → ${squareName(to)}${captured ? ` 吃${pieceGlyph(captured)}` : ""}${check ? " 将军" : ""}`,
  };
  const key = positionKey(board, turn);
  let next: XiangqiState = {
    ...state,
    board,
    turn,
    revision: state.revision + 1,
    lastMove: move,
    history: [...state.history, move],
    positions: [...state.positions, key],
    quietPlies: captured ? 0 : state.quietPlies + 1,
    drawOffer: null,
  };
  if (!legalMoves(board, turn).length)
    return finishXiangqi(next, side, check ? "将死" : "困毙，无棋可走");
  const repeats = next.positions.flatMap((p, i) => (p === key ? [i] : []));
  if (repeats.length >= 3) {
    const cycle = next.history.slice(repeats[repeats.length - 3]);
    const checking = ([1, 2] as const).filter((s) => {
      const moves = cycle.filter((m) => m.piece.side === s);
      return moves.length > 0 && moves.every((m) => m.check);
    });
    next =
      checking.length === 1
        ? finishXiangqi(
            next,
            otherSide(checking[0]),
            `${sideName(checking[0])}长将判负`,
          )
        : finishXiangqi(next, "draw", "同一局面三次重复（娱乐规则）");
  } else if (next.quietPlies >= 120)
    next = finishXiangqi(next, "draw", "连续 120 步未吃子（娱乐规则）");
  return next;
}

const values: Record<XiangqiKind, number> = {
  king: 100000,
  rook: 900,
  cannon: 450,
  horse: 400,
  elephant: 180,
  advisor: 180,
  pawn: 100,
};
function evaluate(board: XiangqiBoard, side: XiangqiSide): number {
  return board.reduce((sum, p, i) => {
    if (!p) return sum;
    const row = Math.floor(i / 9),
      advance = p.side === 1 ? 9 - row : row;
    const bonus =
      p.kind === "pawn"
        ? advance * 7 + (!home(row, p.side) ? 70 : 0)
        : p.kind === "horse" || p.kind === "cannon"
          ? (4 - Math.abs(4 - (i % 9))) * 5
          : 0;
    return sum + (p.side === side ? 1 : -1) * (values[p.kind] + bonus);
  }, 0);
}
/** Small, bounded alpha-beta opponent; no network or game-account side effects. */
export function chooseXiangqiMove(
  state: XiangqiState,
  depth = 2,
): XiangqiAction | null {
  if (state.status !== "playing") return null;
  const moves = legalMoves(state.board, state.turn);
  if (!moves.length) return null;
  let nodes = 0;
  const ordered = (board: XiangqiBoard, actions: XiangqiAction[]) =>
    actions.sort(
      (a, b) =>
        (board[b.to] ? values[board[b.to]!.kind] : 0) -
        (board[a.to] ? values[board[a.to]!.kind] : 0),
    );
  function search(
    board: XiangqiBoard,
    side: XiangqiSide,
    remaining: number,
    alpha: number,
    beta: number,
  ): number {
    nodes++;
    if (nodes > 18000) return evaluate(board, side);
    const choices = legalMoves(board, side);
    if (!choices.length) return -1000000 - remaining;
    if (remaining <= 0) return evaluate(board, side);
    for (const m of ordered(board, choices)) {
      const score = -search(
        movedBoard(board, m.from, m.to),
        otherSide(side),
        remaining - 1,
        -beta,
        -alpha,
      );
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return alpha;
  }
  let best = moves[0],
    score = -Infinity;
  for (const m of ordered(state.board, moves)) {
    const board = movedBoard(state.board, m.from, m.to);
    let value = -search(
      board,
      otherSide(state.turn),
      Math.max(1, Math.min(3, depth)) - 1,
      -Infinity,
      Infinity,
    );
    // Prefer new positions over aimless shuffling when material is equal.
    value -=
      state.positions.filter(
        (p) => p === positionKey(board, otherSide(state.turn)),
      ).length * 30;
    if (value > score) {
      score = value;
      best = m;
    }
  }
  return best;
}

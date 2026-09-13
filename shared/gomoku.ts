export const SIZE = 15;
export type Stone = 0 | 1 | 2;
export type Board = Stone[];
export const newBoard = (): Board => Array<Stone>(SIZE * SIZE).fill(0);
const directions = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];
const inside = (r: number, c: number) =>
  r >= 0 && r < SIZE && c >= 0 && c < SIZE;

function line(
  board: Board,
  index: number,
  player: Stone,
  dr: number,
  dc: number,
) {
  const row = Math.floor(index / SIZE),
    col = index % SIZE;
  let length = 1,
    open = 0;
  for (const sign of [-1, 1]) {
    let r = row + dr * sign,
      c = col + dc * sign;
    while (inside(r, c) && board[r * SIZE + c] === player) {
      length++;
      r += dr * sign;
      c += dc * sign;
    }
    if (inside(r, c) && board[r * SIZE + c] === 0) open++;
  }
  return { length, open };
}

export function isWin(board: Board, index: number): boolean {
  const player = board[index];
  return (
    !!player &&
    directions.some(
      ([dr, dc]) => line(board, index, player, dr, dc).length >= 5,
    )
  );
}

export function placeStone(
  board: Board,
  index: number,
  player: 1 | 2,
): Board | null {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= board.length ||
    board[index] !== 0
  )
    return null;
  const next = [...board];
  next[index] = player;
  return next;
}

function moveScore(board: Board, index: number, player: 1 | 2) {
  let score = 0;
  for (const [dr, dc] of directions) {
    const { length, open } = line(board, index, player, dr, dc);
    if (length >= 5) return 1_000_000;
    if (open === 0) continue;
    if (length === 4) score += open === 2 ? 30_000 : 8_000;
    else if (length === 3) score += open === 2 ? 4_000 : 500;
    else if (length === 2) score += open === 2 ? 200 : 40;
    else score += 4;
  }
  return score;
}

export function chooseComputerMove(board: Board): number | null {
  if (board.every((cell) => cell === 0)) return Math.floor((SIZE * SIZE) / 2);
  let best = -Infinity,
    result: number | null = null;
  for (let index = 0; index < board.length; index++) {
    if (board[index] !== 0) continue;
    const row = Math.floor(index / SIZE),
      col = index % SIZE;
    let nearby = false;
    for (let dr = -2; dr <= 2 && !nearby; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (
          inside(row + dr, col + dc) &&
          board[(row + dr) * SIZE + col + dc] !== 0
        ) {
          nearby = true;
          break;
        }
      }
    }
    if (!nearby) continue;
    const attack = moveScore(board, index, 2),
      defense = moveScore(board, index, 1);
    if (attack >= 1_000_000) return index;
    const score = defense >= 1_000_000 ? 900_000 : attack + defense * 1.1;
    const centeredScore =
      score + (14 - Math.abs(row - 7) - Math.abs(col - 7)) / 100;
    if (centeredScore > best) {
      best = centeredScore;
      result = index;
    }
  }
  return result;
}

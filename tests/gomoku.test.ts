import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseComputerMove,
  isWin,
  newBoard,
  placeStone,
  SIZE,
} from "../shared/gomoku.ts";

test("five in a row wins in all four directions", () => {
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]) {
    const board = newBoard();
    for (let i = 0; i < 5; i++) board[(3 + dr * i) * SIZE + 7 + dc * i] = 1;
    assert.equal(isWin(board, 3 * SIZE + 7), true);
  }
});
test("row edges do not wrap and four stones do not win", () => {
  const board = newBoard();
  for (const index of [13, 14, 15, 16, 17]) board[index] = 1;
  assert.equal(isWin(board, 14), false);
  const four = newBoard();
  [0, 1, 2, 3].forEach((i) => (four[i] = 2));
  assert.equal(isWin(four, 2), false);
});
test("placing a stone preserves the old board and rejects invalid moves", () => {
  const board = newBoard(),
    next = placeStone(board, 10, 1)!;
  assert.equal(board[10], 0);
  assert.equal(next[10], 1);
  assert.equal(placeStone(next, 10, 2), null);
  assert.equal(placeStone(board, -1, 1), null);
  assert.equal(placeStone(board, 225, 1), null);
  assert.equal(placeStone(board, 1.5, 1), null);
});
test("computer takes a win before defending", () => {
  const board = newBoard();
  [0, 1, 2, 3].forEach((i) => (board[i] = 2));
  [30, 31, 32, 33].forEach((i) => (board[i] = 1));
  assert.equal(chooseComputerMove(board), 4);
});
test("computer blocks an immediate loss and never plays occupied points", () => {
  const board = newBoard();
  [0, 1, 2, 3].forEach((i) => (board[i] = 1));
  const move = chooseComputerMove(board);
  assert.equal(move, 4);
  assert.equal(board[move!], 0);
});
test("computer opens in the center and returns no move on a full board", () => {
  assert.equal(chooseComputerMove(newBoard()), 112);
  assert.equal(chooseComputerMove(newBoard().fill(1)), null);
});

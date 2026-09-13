import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceXiangqi,
  chooseXiangqiMove,
  createXiangqi,
  inCheck,
  legalDestinations,
  legalMoves,
  newXiangqiBoard,
  type XiangqiBoard,
  type XiangqiKind,
  type XiangqiSide,
} from "../shared/xiangqi.ts";
const at = (s: string) =>
  (10 - Number(s.slice(1))) * 9 + "ABCDEFGHI".indexOf(s[0]);
function board(
  pieces: Record<string, [XiangqiSide, XiangqiKind] | null>,
): XiangqiBoard {
  const b: XiangqiBoard = Array(90).fill(null);
  for (const [square, piece] of Object.entries({
    E1: [1, "king"],
    F10: [2, "king"],
    ...pieces,
  } as typeof pieces))
    b[at(square)] = piece && { side: piece[0], kind: piece[1] };
  return b;
}
const can = (b: XiangqiBoard, from: string, to: string) =>
  legalDestinations(b, at(from)).includes(at(to));
test("standard setup has 32 pieces and 44 opening moves; moves are immutable", () => {
  const s = createXiangqi("opening");
  assert.equal(s.board.filter(Boolean).length, 32);
  assert.equal(legalMoves(s.board, 1).length, 44);
  assert.equal(legalMoves(s.board, 2).length, 44);
  const next = advanceXiangqi(s, 1, { from: at("A4"), to: at("A5") });
  assert.equal(next.turn, 2);
  assert.equal(next.board[at("A4")], null);
  assert.equal(s.board[at("A4")]?.kind, "pawn");
  assert.equal(s.history.length, 0);
  assert.equal(next.positions.length, 2);
});
test("rooks cannot jump or capture their own piece", () => {
  const b = board({ A1: [1, "rook"], A3: [2, "pawn"], D1: [1, "advisor"] });
  assert.ok(can(b, "A1", "A3"));
  assert.ok(!can(b, "A1", "A4"));
  assert.ok(can(b, "A1", "C1"));
  assert.ok(!can(b, "A1", "D1"));
});
test("cannon movement and capture require zero and exactly one screen respectively", () => {
  const b = board({
    A3: [1, "cannon"],
    A5: [1, "pawn"],
    A8: [2, "rook"],
    A10: [2, "horse"],
  });
  assert.ok(can(b, "A3", "A4"));
  assert.ok(can(b, "A3", "A8"));
  for (const square of ["A5", "A6", "A10"]) assert.ok(!can(b, "A3", square));
  b[at("A5")] = null;
  assert.ok(!can(b, "A3", "A8"));
  b[at("A5")] = { side: 2, kind: "pawn" };
  assert.ok(can(b, "A3", "A8"));
});
test("horse legs block only the corresponding pair of destinations", () => {
  const b = board({ E5: [1, "horse"], E6: [1, "pawn"] });
  assert.ok(!can(b, "E5", "F7"));
  assert.ok(!can(b, "E5", "D7"));
  assert.ok(can(b, "E5", "G6"));
  b[at("E6")] = null;
  assert.ok(can(b, "E5", "F7"));
});
test("elephants cannot cross the river or jump a blocked eye, on either side", () => {
  const b = board({
    C1: [1, "elephant"],
    D2: [1, "pawn"],
    C10: [2, "elephant"],
  });
  assert.ok(!can(b, "C1", "E3"));
  b[at("D2")] = null;
  assert.ok(can(b, "C1", "E3"));
  assert.ok(can(b, "C10", "E8"));
  b[at("D9")] = { side: 2, kind: "pawn" };
  assert.ok(!can(b, "C10", "E8"));
  b[at("E5")] = { side: 1, kind: "elephant" };
  assert.ok(!can(b, "E5", "C7"));
  b[at("E6")] = { side: 2, kind: "elephant" };
  assert.ok(!can(b, "E6", "C4"));
});
test("advisors and generals remain inside the palace", () => {
  const b = board({ D1: [1, "advisor"] });
  assert.ok(can(b, "D1", "E2"));
  assert.ok(!can(b, "D1", "C2"));
  assert.ok(can(b, "E1", "E2"));
  assert.ok(!can(b, "E1", "E3"));
  assert.ok(!can(b, "F10", "G10"));
});
test("soldiers move forward, gain lateral moves across the river, and never move backward", () => {
  const b = board({
    A4: [1, "pawn"],
    A6: [1, "pawn"],
    A10: [1, "pawn"],
    I7: [2, "pawn"],
    I5: [2, "pawn"],
  });
  assert.ok(can(b, "A4", "A5"));
  assert.ok(!can(b, "A4", "B4"));
  assert.ok(can(b, "A6", "B6"));
  assert.ok(!can(b, "A6", "A5"));
  assert.deepEqual(legalDestinations(b, at("A10")), [at("B10")]);
  assert.ok(can(b, "I7", "I6"));
  assert.ok(!can(b, "I7", "H7"));
  assert.ok(can(b, "I5", "H5"));
  assert.ok(!can(b, "I5", "I6"));
});
test("moving the sole blocker cannot expose facing generals", () => {
  const b = board({ F10: null, E10: [2, "king"], E5: [1, "rook"] });
  assert.ok(!inCheck(b, 1));
  assert.ok(!can(b, "E5", "D5"));
  assert.ok(can(b, "E5", "E6"));
  b[at("E5")] = null;
  assert.ok(inCheck(b, 1));
  assert.ok(inCheck(b, 2));
});
test("a check must be answered, including cannon and horse attacks", () => {
  const b = board({ E10: [2, "rook"], A1: [1, "horse"] });
  assert.ok(inCheck(b, 1));
  assert.deepEqual(legalDestinations(b, at("A1")), []);
  assert.ok(can(b, "E1", "D1"));
  assert.ok(!can(b, "E1", "E2"));
  b[at("E10")] = { side: 2, kind: "cannon" };
  assert.ok(!inCheck(b, 1));
  b[at("E5")] = { side: 1, kind: "pawn" };
  assert.ok(inCheck(b, 1));
  b[at("E10")] = null;
  b[at("D3")] = { side: 2, kind: "horse" };
  assert.ok(inCheck(b, 1));
});
test("checkmate ends the game and the computer finds a mate in one", () => {
  const b = board({
    F10: null,
    E10: [2, "king"],
    E8: [1, "rook"],
    D9: [1, "rook"],
    H9: [1, "horse"],
  });
  const s = createXiangqi("mate", b);
  const done = advanceXiangqi(s, 1, { from: at("E8"), to: at("E9") });
  assert.equal(done.winner, 1);
  assert.equal(done.reason, "将死");
  const move = chooseXiangqiMove(s, 1);
  assert.ok(move);
  assert.equal(advanceXiangqi(s, 1, move).winner, 1);
});
test("stalemate is a loss, not a draw", () => {
  const s = createXiangqi(
    "stalemate",
    board({
      F10: null,
      E10: [2, "king"],
      E5: [1, "pawn"],
      D9: [1, "rook"],
      G8: [1, "rook"],
    }),
  );
  const done = advanceXiangqi(s, 1, { from: at("G8"), to: at("F8") });
  assert.equal(inCheck(done.board, 2), false);
  assert.equal(done.winner, 1);
  assert.match(done.reason!, /困毙/);
});
test("threefold casual repetition draws, while one-sided perpetual check loses", () => {
  let s = createXiangqi("repeat", board({ A1: [1, "rook"], I10: [2, "rook"] }));
  for (const [from, to] of Array(2)
    .fill([
      ["A1", "A2"],
      ["I10", "I9"],
      ["A2", "A1"],
      ["I9", "I10"],
    ])
    .flat())
    s = advanceXiangqi(s, s.turn, { from: at(from), to: at(to) });
  assert.equal(s.winner, "draw");
  s = createXiangqi(
    "checking",
    board({
      E1: null,
      D1: [1, "king"],
      F10: null,
      E10: [2, "king"],
      E8: [1, "rook"],
    }),
    2,
  );
  for (const [from, to] of Array(2)
    .fill([
      ["E10", "F10"],
      ["E8", "F8"],
      ["F10", "E10"],
      ["F8", "E8"],
    ])
    .flat())
    s = advanceXiangqi(s, s.turn, { from: at(from), to: at(to) });
  assert.equal(s.winner, 2);
  assert.equal(s.reason, "红方长将判负");
});
test("120 quiet plies draw and captures reset the counter", () => {
  let s = { ...createXiangqi("quiet"), quietPlies: 119 };
  assert.equal(
    advanceXiangqi(s, 1, { from: at("A4"), to: at("A5") }).winner,
    "draw",
  );
  s = {
    ...createXiangqi("capture", board({ A1: [1, "rook"], A3: [2, "pawn"] })),
    quietPlies: 119,
  };
  const next = advanceXiangqi(s, 1, { from: at("A1"), to: at("A3") });
  assert.equal(next.quietPlies, 0);
  assert.equal(next.lastMove?.captured?.kind, "pawn");
});
test("out-of-turn, malformed, self-capture and finished-game actions are rejected", () => {
  const s = createXiangqi("bad");
  assert.throws(() => advanceXiangqi(s, 2, { from: 0, to: 9 }));
  for (const from of [-1, 90, NaN, 1.5])
    assert.throws(() => advanceXiangqi(s, 1, { from, to: 45 }));
  assert.throws(() => advanceXiangqi(s, 1, { from: 81, to: 82 }));
  assert.throws(() =>
    advanceXiangqi({ ...s, status: "finished" }, 1, { from: 54, to: 45 }),
  );
  assert.deepEqual(s.board, newXiangqiBoard());
});
test("computer play preserves both generals and never leaves its own general in check", () => {
  let s = createXiangqi("computer");
  for (let i = 0; i < 24 && s.status === "playing"; i++) {
    const move = chooseXiangqiMove(s, 1);
    assert.ok(move);
    const side = s.turn;
    s = advanceXiangqi(s, side, move);
    assert.ok(!inCheck(s.board, side));
    assert.equal(s.board.filter((p) => p?.kind === "king").length, 2);
  }
});

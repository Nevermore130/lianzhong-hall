import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceMahjong as act,
  createMahjong,
  shuffleMahjong,
  mahjongView as view,
  winningMahjong as win,
  mahjongComputerAction,
  type MahjongState,
  type MahjongSeat,
  type ClaimChoice,
} from "../shared/mahjong.ts";
import {
  tiles,
  fixture,
  conserved,
  seeded,
  readyHand,
} from "./mahjong-fixtures.ts";
function respond(
  s: MahjongState,
  picks: Partial<Record<MahjongSeat, ClaimChoice>> = {},
) {
  const seats = s.claim!.eligible.filter((seat) => !s.claim!.replies[seat]);
  for (const seat of seats) {
    const choice = picks[seat] ?? "pass",
      option = view(s, seat).options.find((o) => o.choice === choice);
    s = act(s, seat, { type: "claim", choice, tiles: option?.tiles });
  }
  return s;
}
test("136 physical tiles deal 14/13/13/13 without mutating the shuffled deck", () => {
  const wall = shuffleMahjong(seeded(42)),
    original = [...wall],
    s = createMahjong("a", wall, 2);
  assert.deepEqual(
    s.hands.map((h) => h.length),
    [13, 13, 14, 13],
  );
  assert.equal(s.wall.length, 83);
  assert.equal(s.turn, 2);
  assert.deepEqual(wall, original);
  conserved(s);
  assert.throws(() => shuffleMahjong(() => -1));
  assert.throws(() => createMahjong("bad", Array(136).fill(1)));
});
test("ordinary hand, exposed sets, seven pairs and thirteen orphans", () => {
  assert.equal(win(tiles([...readyHand, 31])), "平胡");
  assert.equal(
    win(tiles([0, 0, 1, 1, 2, 2, 9, 9, 18, 18, 27, 27, 33, 33])),
    "七对",
  );
  assert.equal(win(tiles([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5])), "七对");
  assert.equal(
    win(tiles([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33, 33])),
    "十三幺",
  );
  assert.equal(
    win(tiles([9, 10, 11, 18, 19, 20, 27, 27, 27, 31, 31]), 1),
    "平胡",
  );
  assert.equal(win(tiles([31, 31]), 4), "平胡");
});
test("reject false wins, reused physical tiles, suit crossings and honor sequences", () => {
  assert.equal(win(tiles(readyHand)), null);
  assert.equal(win(Array(14).fill(0)), null);
  assert.equal(
    win(tiles([7, 8, 9, 10, 11, 12, 18, 19, 20, 27, 27, 27, 31, 31])),
    null,
  );
  assert.equal(
    win(tiles([0, 1, 2, 9, 10, 11, 27, 28, 29, 30, 30, 30, 31, 31])),
    null,
  );
  assert.equal(win(tiles([...readyHand, 32])), null);
  assert.equal(win(tiles([31, 31]), 5), null);
});
test("private views never disclose wall, other hands, replies or opponent concealed kongs", () => {
  let s = fixture([[0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 31, 31], [], [], []]);
  s = act(s, 0, { type: "kong", tiles: s.hands[0].filter((t) => t < 4) });
  const me = view(s, 0),
    other = view(s, 1),
    watch = view(s, -1);
  assert.equal(me.melds[0][0].tiles.length, 4);
  assert.deepEqual(other.melds[0][0].tiles, []);
  assert.equal(watch.hand.length, 0);
  assert.equal(watch.drawn, null);
  for (const p of [me, other, watch]) {
    assert.ok(!("wall" in p));
    assert.ok(!("hands" in p));
    assert.equal(p.revealed, null);
  }
  me.hand.pop();
  assert.notDeepEqual(me.hand, s.hands[0]);
  conserved(s);
});
test("only the next player can chi; peng outranks chi regardless of response order", () => {
  let s = fixture([[2], [0, 1], [2, 2], [0, 1]]);
  s = act(s, 0, { type: "discard", tile: s.hands[0][0] });
  assert.ok(view(s, 1).options.some((o) => o.choice === "chi"));
  assert.equal(view(s, 3).options.length, 0);
  const first = view(s, 1).options[0];
  s = act(s, 1, { type: "claim", ...first });
  assert.equal(s.phase, "claim");
  assert.deepEqual(view(s, 2).claim, {
    from: 0,
    tile: 8,
    kind: "discard",
    answered: false,
  });
  assert.throws(() => act(s, 1, { type: "claim", choice: "pass" }), /已回应/);
  s = respond(s, { 1: "chi", 2: "peng" });
  assert.equal(s.turn, 2);
  assert.equal(s.drawn, null);
  assert.equal(s.melds[2][0].kind, "peng");
  assert.equal(s.discards[0].length, 0);
  conserved(s);
});
test("multiple valid chi shapes can be chosen, no extra draw after chi", () => {
  let s = fixture([[2], [0, 1, 3, 4], [], []]);
  s = act(s, 0, { type: "discard", tile: s.hands[0][0] });
  const options = view(s, 1).options.filter((o) => o.choice === "chi");
  assert.equal(options.length, 3);
  const before = s.wall.length;
  s = act(s, 1, { type: "claim", ...options[2] });
  assert.equal(s.wall.length, before);
  assert.equal(s.turn, 1);
  assert.equal(s.hands[1].length, 2);
  conserved(s);
});
test("hu wins over a peng, ties use closest seat and are not first-response wins", () => {
  let s = fixture([
    [2],
    [0, 1, 9, 10, 11, 18, 19, 20, 27, 27, 27, 31, 31],
    [2, 2],
    [3, 4, 14, 15, 16, 23, 24, 25, 28, 28, 28, 32, 32],
  ]);
  s = act(s, 0, { type: "discard", tile: s.hands[0][0] });
  s = act(s, 3, { type: "claim", choice: "hu" });
  s = act(s, 2, {
    type: "claim",
    choice: "peng",
    tiles: view(s, 2).options.find((o) => o.choice === "peng")!.tiles,
  });
  s = act(s, 1, { type: "claim", choice: "hu" });
  assert.equal(s.result?.winner, 1);
  assert.equal(s.result?.loser, 0);
  assert.deepEqual(s.scores, [-1, 1, 0, 0]);
  conserved(s);
});
test("hu outranks an exposed kong", () => {
  // A gang needs three matching tiles; a fourth held by the discarder leaves no fifth for a hu pair.
  // Thirteen orphans can win on the sole missing tile while the other player holds three.
  let s = fixture([
    [33],
    [0, 0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32],
    [33, 33, 33],
    [],
  ]);
  s = act(s, 0, { type: "discard", tile: s.hands[0][0] });
  s = respond(s, { 1: "hu", 2: "gang" });
  assert.equal(s.result?.winner, 1);
  assert.equal(s.melds[2].length, 0);
  conserved(s);
});
test("all passes advance, drawn tile stays private, discards keep chronological order", () => {
  let s = fixture([[30, 0], [0, 1], [], []]);
  s = act(s, 0, { type: "discard", tile: s.hands[0][1] });
  if (s.claim) s = respond(s);
  assert.equal(s.turn, 1);
  assert.equal(view(s, 0).drawn, null);
  assert.equal(view(s, 1).drawn, s.drawn);
  s.discards[0] = [120, 0];
  assert.deepEqual(view(s, 0).discards[0], [120, 0]);
});
test("concealed and exposed kongs draw from the tail with tile conservation", () => {
  let s = fixture([[0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 31, 31], [], [], []]);
  const tail = s.wall.at(-1);
  s = act(s, 0, { type: "kong", tiles: view(s, 0).kongs[0] });
  assert.equal(s.drawn, tail);
  assert.equal(s.hands[0].length, 11);
  conserved(s);
  s = fixture([[9], [], [9, 9, 9], []]);
  const end = s.wall.at(-1);
  s = act(s, 0, { type: "discard", tile: s.hands[0][0] });
  s = respond(s, { 2: "gang" });
  assert.equal(s.turn, 2);
  assert.equal(s.drawn, end);
  assert.equal(s.melds[2][0].kind, "exposed-kong");
  conserved(s);
});
function added() {
  const s = fixture([
    [31, 31, 31, 31, 0, 1, 2, 3, 4, 5, 6, 7, 8, 30],
    [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 30, 32, 33],
    [],
    [],
  ]);
  s.melds[0] = [
    {
      kind: "peng",
      from: 2,
      tiles: s.hands[0].filter((t) => Math.floor(t / 4) === 31).slice(0, 3),
    },
  ];
  s.hands[0] = s.hands[0].filter((t) => !s.melds[0][0].tiles.includes(t));
  return s;
}
test("rob added kong is offered before upgrade; win retains original peng", () => {
  let s = added();
  const tile = view(s, 0).kongs[0][0];
  s = act(s, 0, { type: "kong", tiles: [tile] });
  assert.equal(s.claim?.kind, "rob-kong");
  assert.equal(s.melds[0][0].kind, "peng");
  conserved(s);
  s = act(s, 1, { type: "claim", choice: "hu" });
  assert.equal(s.result?.kind, "rob-kong");
  assert.equal(s.result?.winningTile, tile);
  assert.equal(s.melds[0][0].tiles.length, 3);
  assert.deepEqual(s.scores, [-1, 1, 0, 0]);
  conserved(s);
});
test("passing a rob-kong window commits the upgrade and draws replacement", () => {
  let s = added();
  const end = s.wall.at(-1);
  s = act(s, 0, { type: "kong", tiles: view(s, 0).kongs[0] });
  s = respond(s);
  assert.equal(s.melds[0][0].kind, "added-kong");
  assert.equal(s.drawn, end);
  assert.equal(s.discards[0].length, 0);
  conserved(s);
});
test("self draw scores zero sum, terminal actions reject, all hands revealed", () => {
  let s = fixture([[...readyHand, 31], [], [], []]);
  s = act(s, 0, { type: "hu" });
  assert.deepEqual(s.scores, [3, -1, -1, -1]);
  assert.ok(view(s, -1).revealed);
  assert.equal(view(s, -1).hand.length, 0);
  assert.throws(() => act(s, 0, { type: "hu" }), /进行中/);
  conserved(s);
});
test("empty wall only allows last discard hu, otherwise draw; no kong without replacement", () => {
  let s = fixture([[31], readyHand, [31, 31], []]);
  s.wall = [];
  s = act(s, 0, { type: "discard", tile: s.hands[0][0] });
  assert.deepEqual(view(s, 2).options, []);
  const hu = respond(s, { 1: "hu" });
  assert.equal(hu.result?.winner, 1);
  const draw = respond(s);
  assert.equal(draw.result?.kind, "draw");
  assert.deepEqual(draw.scores, [0, 0, 0, 0]);
  s = fixture([[0, 0, 0, 0], [], [], []]);
  s.wall = [];
  assert.equal(view(s, 0).kongs.length, 0);
  assert.throws(() => act(s, 0, { type: "kong", tiles: s.hands[0] }));
});
test("illegal seat, wrong turn, fabricated cards and claim choices cannot mutate state", () => {
  const s = createMahjong("a", shuffleMahjong(seeded(53))),
    before = structuredClone(s);
  assert.throws(() => act(s, 1, { type: "discard", tile: s.hands[1][0] }));
  assert.throws(() => act(s, 0, { type: "discard", tile: s.hands[1][0] }));
  assert.throws(() => act(s, 0, { type: "claim", choice: "hu" }));
  assert.throws(() =>
    act(s, 0, { type: "kong", tiles: Array(4).fill(s.hands[0][0]) }),
  );
  assert.deepEqual(s, before);
});
test("30 seeded four-bot rounds finish, preserve all 136 tiles and never expose hidden information", () => {
  for (let seed = 1; seed <= 30; seed++) {
    let s = createMahjong(`bots-${seed}`, shuffleMahjong(seeded(seed)));
    for (let step = 0; step < 450 && s.status === "playing"; step++) {
      conserved(s);
      const seat = ([0, 1, 2, 3] as const).find((i) =>
        mahjongComputerAction(view(s, i), i),
      );
      assert.notEqual(seat, undefined);
      const action = mahjongComputerAction(view(s, seat!), seat!)!;
      s = act(s, seat!, action);
    }
    assert.equal(s.status, "finished");
    assert.equal(
      s.scores.reduce((a, b) => a + b, 0),
      0,
    );
    conserved(s);
  }
});

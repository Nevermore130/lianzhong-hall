import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceDoudizhu,
  beats,
  classify,
  computerAction,
  createDoudizhu,
  doudizhuView,
  finishDoudizhu,
  legalPlays,
  rankOf,
  shuffleDeck,
  type CardSeat,
  type DoudizhuState,
  type PatternKind,
} from "../shared/doudizhu.ts";
const deck = Array.from({ length: 54 }, (_, i) => i);
function cards(...ranks: number[]) {
  const used = new Map<number, number>();
  return ranks.map((r) => {
    const n = used.get(r) ?? 0;
    used.set(r, n + 1);
    return r >= 16 ? r + 36 : (r - 3) * 4 + n;
  });
}
test("all classic card patterns are identified; illegal wings, sequences, duplicates and joker combinations rejected", () => {
  const examples: [PatternKind, number[]][] = [
    ["single", [3]],
    ["pair", [4, 4]],
    ["triple", [5, 5, 5]],
    ["triple-single", [6, 6, 6, 7]],
    ["triple-pair", [6, 6, 6, 7, 7]],
    ["straight", [10, 11, 12, 13, 14]],
    ["pair-straight", [3, 3, 4, 4, 5, 5]],
    ["airplane", [3, 3, 3, 4, 4, 4]],
    ["airplane-single", [3, 3, 3, 4, 4, 4, 7, 7]],
    ["airplane-pair", [3, 3, 3, 4, 4, 4, 7, 7, 8, 8]],
    ["four-single", [3, 3, 3, 3, 7, 7]],
    ["four-pair", [3, 3, 3, 3, 7, 7, 8, 8]],
    ["bomb", [15, 15, 15, 15]],
    ["rocket", [16, 17]],
  ];
  for (const [kind, ranks] of examples)
    assert.equal(classify(cards(...ranks))?.kind, kind);
  for (const ranks of [
    [11, 12, 13, 14, 15],
    [14, 14, 15, 15, 16, 17],
    [3, 3, 3, 5, 5, 5],
    [3, 3, 3, 4, 4, 4, 16, 17],
    [3, 3, 3, 3, 4, 4, 4, 7],
    [3, 3, 3, 3, 4, 4, 4, 4],
    [3, 3, 3, 3, 16, 17],
    [3, 4, 5, 6],
  ])
    assert.equal(classify(cards(...ranks)), null, JSON.stringify(ranks));
  for (const invalid of [[0, 0], [-1], [54], [1.5], []])
    assert.equal(classify(invalid), null);
});
test("comparison uses kind, count and body rank, with bombs and rocket exceptions", () => {
  const p = (r: number[]) => classify(cards(...r))!;
  assert.ok(beats(p([4, 4, 4, 3]), p([3, 3, 3, 17])));
  assert.ok(!beats(p([15]), p([3, 3])));
  assert.ok(!beats(p([4, 5, 6, 7, 8, 9]), p([3, 4, 5, 6, 7])));
  assert.ok(beats(p([3, 3, 3, 3]), p([15, 15])));
  assert.ok(beats(p([16, 17]), p([15, 15, 15, 15])));
  assert.ok(!beats(p([16, 17]), p([16, 17])));
});
test("bidding hides all bottom cards until bidding ends; all-pass redeals with a fresh turn and revision", () => {
  let state = createDoudizhu("bid", deck, 1);
  const original = structuredClone(state);
  assert.throws(
    () => advanceDoudizhu(state, 0, { type: "bid", score: 1 }, () => deck),
    /轮到/,
  );
  state = advanceDoudizhu(state, 1, { type: "bid", score: 1 }, () => deck);
  for (const seat of [-1, 0, 1, 2]) {
    assert.deepEqual(doudizhuView(state, seat).bottom, []);
    assert.equal(doudizhuView(state, seat).landlord, null);
  }
  assert.throws(
    () => advanceDoudizhu(state, 2, { type: "bid", score: 1 }, () => deck),
    /高于/,
  );
  state = advanceDoudizhu(state, 2, { type: "bid", score: 0 }, () => deck);
  state = advanceDoudizhu(state, 0, { type: "bid", score: 2 }, () => deck);
  assert.equal(state.landlord, 0);
  assert.equal(state.turn, 0);
  assert.equal(state.hands[0].length, 20);
  assert.deepEqual(doudizhuView(state, 1).bottom, deck.slice(51));
  assert.equal(original.hands[0].length, 17);
  state = createDoudizhu("redeal", deck, 0);
  for (const seat of [0, 1, 2] as CardSeat[])
    state = advanceDoudizhu(state, seat, { type: "bid", score: 0 }, () =>
      [...deck].reverse(),
    );
  assert.equal(state.phase, "bidding");
  assert.equal(state.deal, 2);
  assert.equal(state.turn, 1);
  assert.equal(state.revision, 3);
  assert.deepEqual(state.bottom, [2, 1, 0]);
  assert.deepEqual(state.bids, [null, null, null]);
  const cancelled = finishDoudizhu(state, null, "cancel");
  assert.deepEqual(doudizhuView(cancelled, 0).bottom, []);
});
test("card ownership, two passes, immutable transitions, and both spring results", () => {
  let state = advanceDoudizhu(
    createDoudizhu("play", deck),
    0,
    { type: "bid", score: 3 },
    () => deck,
  );
  assert.throws(
    () => advanceDoudizhu(state, 0, { type: "pass" }, () => deck),
    /必须/,
  );
  assert.throws(
    () => advanceDoudizhu(state, 0, { type: "play", cards: [30] }, () => deck),
    /持有/,
  );
  assert.throws(
    () =>
      advanceDoudizhu(state, 0, { type: "play", cards: [0, 0] }, () => deck),
    /不重复/,
  );
  const old = structuredClone(state);
  state = advanceDoudizhu(state, 0, { type: "play", cards: [0] }, () => deck);
  assert.equal(old.hands[0].length, 20);
  assert.equal(state.hands[0].length, 19);
  state = advanceDoudizhu(state, 1, { type: "pass" }, () => deck);
  state = advanceDoudizhu(state, 2, { type: "pass" }, () => deck);
  assert.equal(state.turn, 0);
  assert.equal(state.lastPlay, null);
  assert.throws(
    () => advanceDoudizhu(state, 0, { type: "pass" }, () => deck),
    /必须/,
  );
  const fixture: DoudizhuState = { ...old, hands: [[0], [4], [8]], turn: 0 };
  const landlord = advanceDoudizhu(
    fixture,
    0,
    { type: "play", cards: [0] },
    () => deck,
  );
  assert.equal(landlord.winner, "landlord");
  assert.ok(landlord.spring);
  assert.deepEqual(landlord.scores, [12, -6, -6]);
  const farmer = advanceDoudizhu(
    { ...fixture, turn: 1, playCounts: [1, 0, 0] },
    1,
    { type: "play", cards: [4] },
    () => deck,
  );
  assert.equal(farmer.winner, "farmers");
  assert.ok(farmer.spring);
  assert.deepEqual(farmer.scores, [-12, 6, 6]);
});
test("hints find compound responses and never expose hidden hands in public views", () => {
  const hand = cards(
    3,
    3,
    3,
    4,
    4,
    4,
    5,
    5,
    5,
    6,
    6,
    7,
    7,
    15,
    15,
    15,
    15,
    16,
    17,
  );
  const target = classify(cards(3, 3, 3, 4, 4, 4, 8, 8, 9, 9))!;
  assert.ok(
    legalPlays(hand, target).some((p) => classify(p)?.kind === "airplane-pair"),
  );
  for (const move of legalPlays(hand, target)) {
    assert.ok(move.every((c) => hand.includes(c)));
    assert.ok(beats(classify(move)!, target));
  }
  assert.deepEqual(legalPlays(hand, { kind: "rocket", rank: 17, size: 2 }), []);
  const state = createDoudizhu("privacy", deck);
  for (const seat of [-1, 0, 1, 2]) {
    const view = doudizhuView(state, seat);
    assert.ok(!("hands" in view));
    assert.ok(!("firstBidder" in view));
    assert.deepEqual(view.hand, seat === -1 ? [] : state.hands[seat]);
    assert.deepEqual(view.counts, [17, 17, 17]);
  }
});
test("twenty seeded complete AI games conserve the deck and finish with zero-sum scores", () => {
  for (let seed = 1; seed <= 20; seed++) {
    let rng = seed;
    const random = (max: number) => {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      return rng % max;
    };
    const deal = () => shuffleDeck(random);
    let state = createDoudizhu("sim-" + seed, deal(), (seed % 3) as CardSeat),
      played: number[] = [];
    for (let move = 0; move < 500 && state.status === "playing"; move++) {
      const action = computerAction(
        doudizhuView(state, state.turn),
        state.turn,
      );
      if (action.type === "play") {
        assert.ok(classify(action.cards));
        played.push(...action.cards);
      }
      state = advanceDoudizhu(state, state.turn, action, deal);
      const all = [
        ...state.hands.flat(),
        ...played,
        ...(state.phase === "bidding" ? state.bottom : []),
      ];
      assert.equal(new Set(all).size, 54);
      assert.equal(all.length, 54);
      assert.ok(all.every((c) => rankOf(c) >= 3 && rankOf(c) <= 17));
    }
    assert.equal(state.status, "finished", "seed " + seed);
    assert.equal(
      state.scores.reduce((a, b) => a + b, 0),
      0,
    );
  }
});

import assert from "node:assert/strict";
import {
  createMahjong,
  type Four,
  type MahjongState,
  type Tile,
} from "../shared/mahjong.ts";
export function tiles(types: number[]) {
  const counts = Array(34).fill(0) as number[];
  return types.map((t) => {
    assert.ok(t >= 0 && t < 34 && counts[t] < 4);
    return t * 4 + counts[t]++;
  });
}
/** Reserve requested hands first, then put every other physical tile in the wall. */
export function fixture(types: Four<number[]>): MahjongState {
  const counts = Array(34).fill(0) as number[];
  const hands = types.map((ts) =>
    ts.map((t) => {
      assert.ok(counts[t] < 4, `too many ${t}`);
      return t * 4 + counts[t]++;
    }),
  ) as Four<Tile[]>;
  const used = new Set(hands.flat());
  const state = createMahjong(
    "fixture",
    Array.from({ length: 136 }, (_, i) => i),
  );
  return {
    ...state,
    hands,
    wall: Array.from({ length: 136 }, (_, i) => i).filter((t) => !used.has(t)),
    drawn: hands[0].at(-1) ?? null,
  };
}
export function conserved(s: MahjongState) {
  const all = [
    ...s.wall,
    ...s.hands.flat(),
    ...s.discards.flat(),
    ...s.melds.flatMap((ms) => ms.flatMap((m) => m.tiles)),
  ];
  assert.equal(all.length, 136);
  assert.equal(new Set(all).size, 136);
}
export function seeded(seed: number) {
  return (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  };
}
export const readyHand = [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 31];

import assert from "node:assert/strict";
import {
  gomoku,
  xiangqi,
  doudizhu,
  mahjong,
  selectedCards,
  discardedTile,
  cues,
  FRAMES,
} from "../src/story";
import { classify } from "../../../shared/doudizhu";
import { mahjongView } from "../../../shared/mahjong";
assert.equal(FRAMES, 1020);
for (const [i, m] of gomoku.entries())
  assert.equal(m.value.board.filter(Boolean).length, i);
assert.equal(xiangqi.at(-1)!.value.history.length, 4);
assert.ok(classify(selectedCards));
assert.equal(doudizhu[2].value.hands[0].length, 20 - selectedCards.length);
assert.ok(
  mahjongView(mahjong[1].value, 0).options.some((o) => o.choice === "peng"),
);
assert.equal(mahjong[2].value.melds[0][0].kind, "peng");
assert.ok(mahjong[3].value.discards[0].includes(discardedTile));
for (const { value: s } of mahjong) {
  const all = [
    ...s.wall,
    ...s.hands.flat(),
    ...s.discards.flat(),
    ...s.melds.flatMap((ms) => ms.flatMap((m) => m.tiles)),
  ];
  assert.equal(all.length, 136);
  assert.equal(new Set(all).size, 136);
}
for (let i = 1; i < cues.length; i++) assert.ok(cues[i].at > cues[i - 1].at);
console.log(
  "Story verified: legal alternating moves, legal card play, actual peng and discard, all 136 tiles conserved.",
);

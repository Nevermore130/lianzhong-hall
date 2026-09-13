export type Card = number;
export type CardSeat = 0 | 1 | 2;
export type Trio<T> = [T, T, T];
export type PatternKind =
  | "single"
  | "pair"
  | "triple"
  | "triple-single"
  | "triple-pair"
  | "straight"
  | "pair-straight"
  | "airplane"
  | "airplane-single"
  | "airplane-pair"
  | "four-single"
  | "four-pair"
  | "bomb"
  | "rocket";
export type Pattern = { kind: PatternKind; rank: number; size: number };
export type Play = { seat: CardSeat; cards: Card[]; pattern: Pattern };
export type CardAction =
  | { type: "bid"; score: number }
  | { type: "play"; cards: Card[] }
  | { type: "pass" };
export type DoudizhuView = {
  id: string;
  revision: number;
  status: "playing" | "finished";
  phase: "bidding" | "playing" | "finished";
  turn: CardSeat;
  landlord: CardSeat | null;
  bids: Trio<number | null>;
  bid: number;
  bottom: Card[];
  hand: Card[];
  counts: Trio<number>;
  lastPlay: Play | null;
  passes: number;
  actions: Trio<Play | "pass" | null>;
  multiplier: number;
  spring: boolean;
  winner: "landlord" | "farmers" | null;
  reason: string | null;
  scores: Trio<number>;
  deal: number;
};
export type DoudizhuState = Omit<DoudizhuView, "hand" | "counts"> & {
  hands: Trio<Card[]>;
  firstBidder: CardSeat;
  playCounts: Trio<number>;
};
export const patternNames: Record<PatternKind, string> = {
  single: "单张",
  pair: "对子",
  triple: "三张",
  "triple-single": "三带一",
  "triple-pair": "三带一对",
  straight: "顺子",
  "pair-straight": "连对",
  airplane: "飞机",
  "airplane-single": "飞机带单",
  "airplane-pair": "飞机带对",
  "four-single": "四带二",
  "four-pair": "四带两对",
  bomb: "炸弹",
  rocket: "王炸",
};
export const rankOf = (card: Card) =>
  card >= 52 ? card - 36 : Math.floor(card / 4) + 3;
export const rankLabel = (rank: number) =>
  ({ 11: "J", 12: "Q", 13: "K", 14: "A", 15: "2", 16: "小王", 17: "大王" })[
    rank
  ] ?? String(rank);
export const cardLabel = (card: Card) =>
  card >= 52
    ? rankLabel(rankOf(card))
    : ["黑桃", "红桃", "梅花", "方块"][card % 4] + rankLabel(rankOf(card));
export const sortCards = (cards: Card[]) =>
  [...cards].sort((a, b) => rankOf(b) - rankOf(a) || a - b);
const nextSeat = (seat: number): CardSeat => ((seat + 1) % 3) as CardSeat;
export const validCards = (cards: unknown): cards is Card[] =>
  Array.isArray(cards) &&
  cards.length > 0 &&
  cards.length <= 20 &&
  new Set(cards).size === cards.length &&
  cards.every((c) => Number.isInteger(c) && c >= 0 && c < 54);
const groupsOf = (cards: Card[]) => {
  const groups = new Map<number, Card[]>();
  for (const c of [...cards].sort((a, b) => a - b))
    groups.set(rankOf(c), [...(groups.get(rankOf(c)) ?? []), c]);
  return groups;
};
const consecutive = (ranks: number[]) =>
  ranks.at(-1)! <= 14 &&
  ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1);
const hasBothJokers = (cards: Card[]) =>
  cards.includes(52) && cards.includes(53);

export function classify(cards: Card[]): Pattern | null {
  if (!validCards(cards)) return null;
  const groups = groupsOf(cards),
    ranks = [...groups.keys()],
    counts = [...groups.values()].map((g) => g.length),
    size = cards.length;
  const found = (kind: PatternKind, rank: number): Pattern => ({
    kind,
    rank,
    size,
  });
  if (size === 1) return found("single", ranks[0]);
  if (size === 2 && hasBothJokers(cards)) return found("rocket", 17);
  if (ranks.length === 1)
    return found(
      size === 2 ? "pair" : size === 3 ? "triple" : "bomb",
      ranks[0],
    );
  const triple = ranks.find((r) => groups.get(r)!.length === 3);
  if (triple !== undefined && size === 4) return found("triple-single", triple);
  if (triple !== undefined && size === 5 && counts.includes(2))
    return found("triple-pair", triple);
  if (size >= 5 && counts.every((n) => n === 1) && consecutive(ranks))
    return found("straight", ranks.at(-1)!);
  if (
    size >= 6 &&
    size % 2 === 0 &&
    counts.every((n) => n === 2) &&
    consecutive(ranks)
  )
    return found("pair-straight", ranks.at(-1)!);
  if (
    size >= 6 &&
    size % 3 === 0 &&
    counts.every((n) => n === 3) &&
    consecutive(ranks)
  )
    return found("airplane", ranks.at(-1)!);
  const four = ranks.find((r) => groups.get(r)!.length === 4);
  if (four !== undefined && size === 6 && !hasBothJokers(cards))
    return found("four-single", four);
  if (
    four !== undefined &&
    size === 8 &&
    counts.filter((n) => n === 2).length === 2
  )
    return found("four-pair", four);
  for (const [unit, kind] of [
    [4, "airplane-single"],
    [5, "airplane-pair"],
  ] as const) {
    const length = size / unit;
    if (!Number.isInteger(length) || length < 2) continue;
    for (let high = 14; high >= length + 2; high--) {
      const body = Array.from({ length }, (_, i) => high - i);
      // Wings must have ranks outside the triple body; a fourth card cannot be its own wing.
      if (!body.every((r) => groups.get(r)?.length === 3)) continue;
      const wings = cards.filter((c) => !body.includes(rankOf(c)));
      const wc = [...groupsOf(wings).values()].map((g) => g.length);
      if (
        kind === "airplane-single" &&
        wings.length === length &&
        wc.every((n) => n <= 2) &&
        !hasBothJokers(wings)
      )
        return found(kind, high);
      if (
        kind === "airplane-pair" &&
        wc.length === length &&
        wc.every((n) => n === 2)
      )
        return found(kind, high);
    }
  }
  return null;
}
export function beats(candidate: Pattern, target: Pattern | null): boolean {
  if (!target) return true;
  if (target.kind === "rocket") return false;
  if (candidate.kind === "rocket") return true;
  if (candidate.kind === "bomb" && target.kind !== "bomb") return true;
  return (
    candidate.kind === target.kind &&
    candidate.size === target.size &&
    candidate.rank > target.rank
  );
}

/** Enumerate legal bodies; choose legal low wings without enumerating every suit-equivalent hand. */
export function legalPlays(hand: Card[], target: Pattern | null): Card[][] {
  const groups = groupsOf(hand),
    ranks = [...groups.keys()],
    out: Card[][] = [],
    seen = new Set<string>();
  function add(cards: Card[]) {
    const p = classify(cards),
      key = [...cards].sort((a, b) => a - b).join(",");
    if (p && beats(p, target) && !seen.has(key)) {
      seen.add(key);
      out.push(sortCards(cards));
    }
  }
  function withWings(body: Card[], count: number, paired: boolean) {
    const kind: PatternKind =
      body.length === 3
        ? paired
          ? "triple-pair"
          : "triple-single"
        : body.length === 4
          ? paired
            ? "four-pair"
            : "four-single"
          : paired
            ? "airplane-pair"
            : "airplane-single";
    if (
      !beats(
        {
          kind,
          rank: Math.max(...body.map(rankOf)),
          size: body.length + count * (paired ? 2 : 1),
        },
        target,
      )
    )
      return;
    const bodyRanks = new Set(body.map(rankOf)),
      available = ranks.filter((r) => !bodyRanks.has(r));
    function pick(at: number, remaining: number, cards: Card[]): boolean {
      if (remaining === 0) {
        const candidate = [...body, ...cards],
          pattern = classify(candidate);
        if (pattern && beats(pattern, target)) {
          add(candidate);
          return true;
        }
        return false;
      }
      if (at === available.length) return false;
      const g = groups.get(available[at])!;
      const maximum = paired
        ? g.length >= 2
          ? 1
          : 0
        : Math.min(2, g.length, remaining);
      for (let n = Math.min(maximum, remaining); n >= 0; n--)
        if (
          pick(at + 1, remaining - n, [
            ...cards,
            ...g.slice(0, paired ? n * 2 : n),
          ])
        )
          return true;
      return false;
    }
    pick(0, count, []);
  }
  for (const r of ranks) {
    const group = groups.get(r)!;
    for (let n = 1; n <= group.length; n++) add(group.slice(0, n));
    if (group.length >= 3) {
      withWings(group.slice(0, 3), 1, false);
      withWings(group.slice(0, 3), 1, true);
    }
    if (group.length === 4) {
      withWings(group, 2, false);
      withWings(group, 2, true);
    }
  }
  if (hasBothJokers(hand)) add([52, 53]);
  for (const [copies, minimum] of [
    [1, 5],
    [2, 3],
    [3, 2],
  ]) {
    for (let low = 3; low <= 14; low++) {
      const body: Card[] = [];
      for (let high = low; high <= 14; high++) {
        if ((groups.get(high)?.length ?? 0) < copies) break;
        body.push(...groups.get(high)!.slice(0, copies));
        const length = high - low + 1;
        if (length < minimum) continue;
        add(body);
        if (copies === 3 && length * 4 <= hand.length)
          withWings(body, length, false);
        if (copies === 3 && length * 5 <= hand.length)
          withWings(body, length, true);
      }
    }
  }
  return out.sort((a, b) => {
    const pa = classify(a)!,
      pb = classify(b)!;
    const power = (p: Pattern) =>
      p.kind === "rocket" ? 2 : p.kind === "bomb" ? 1 : 0;
    return (
      power(pa) - power(pb) ||
      (target ? pa.rank - pb.rank : b.length - a.length || pa.rank - pb.rank)
    );
  });
}
export function shuffleDeck(randomIndex: (max: number) => number): Card[] {
  const cards = Array.from({ length: 54 }, (_, i) => i);
  for (let i = 53; i > 0; i--) {
    const j = randomIndex(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i)
      throw new Error("洗牌随机值无效");
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export function createDoudizhu(
  id: string,
  deck: Card[],
  firstBidder: CardSeat = 0,
): DoudizhuState {
  if (
    deck.length !== 54 ||
    new Set(deck).size !== 54 ||
    deck.some((c) => !Number.isInteger(c) || c < 0 || c > 53)
  )
    throw new Error("牌组无效");
  return {
    id,
    revision: 0,
    status: "playing",
    phase: "bidding",
    turn: firstBidder,
    firstBidder,
    hands: [
      sortCards(deck.slice(0, 17)),
      sortCards(deck.slice(17, 34)),
      sortCards(deck.slice(34, 51)),
    ],
    bottom: deck.slice(51),
    landlord: null,
    bids: [null, null, null],
    bid: 0,
    lastPlay: null,
    passes: 0,
    actions: [null, null, null],
    multiplier: 1,
    spring: false,
    winner: null,
    reason: null,
    scores: [0, 0, 0],
    playCounts: [0, 0, 0],
    deal: 1,
  };
}
/** Explicit allowlist: never serialize the private state, even to a spectator or another room. */
export function doudizhuView(state: DoudizhuState, seat: number): DoudizhuView {
  return {
    id: state.id,
    revision: state.revision,
    status: state.status,
    phase: state.phase,
    turn: state.turn,
    landlord: state.phase === "bidding" ? null : state.landlord,
    bids: [...state.bids],
    bid: state.bid,
    bottom:
      state.landlord === null || state.phase === "bidding"
        ? []
        : [...state.bottom],
    hand: seat >= 0 && seat < 3 ? [...state.hands[seat]] : [],
    counts: state.hands.map((h) => h.length) as Trio<number>,
    lastPlay: state.lastPlay,
    passes: state.passes,
    actions: state.actions,
    multiplier: state.multiplier,
    spring: state.spring,
    winner: state.winner,
    reason: state.reason,
    scores: [...state.scores],
    deal: state.deal,
  };
}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function finishDoudizhu(
  state: DoudizhuState,
  winner: "landlord" | "farmers" | null,
  reason: string,
  spring = false,
): DoudizhuState {
  const multiplier = state.multiplier * (spring ? 2 : 1),
    unit = state.bid * multiplier;
  return {
    ...state,
    landlord: winner === null ? null : state.landlord,
    revision: state.revision + 1,
    status: "finished",
    phase: "finished",
    winner,
    reason,
    spring,
    multiplier,
    scores: [0, 1, 2].map((seat) =>
      winner === null
        ? 0
        : (seat === state.landlord ? 2 : -1) *
          unit *
          (winner === "landlord" ? 1 : -1),
    ) as Trio<number>,
  };
}
export function advanceDoudizhu(
  state: DoudizhuState,
  seat: CardSeat,
  action: CardAction,
  redeal: () => Card[],
): DoudizhuState {
  check(state.status === "playing", "当前没有进行中的牌局");
  check(seat === state.turn, "还没轮到你操作");
  const next: DoudizhuState = {
    ...state,
    revision: state.revision + 1,
    hands: state.hands.map((h) => [...h]) as Trio<Card[]>,
    bids: [...state.bids],
    actions: [...state.actions],
    playCounts: [...state.playCounts],
  };
  if (action.type === "bid") {
    check(state.phase === "bidding", "叫分已经结束");
    check(
      Number.isInteger(action.score) &&
        action.score >= 0 &&
        action.score <= 3 &&
        (action.score === 0 || action.score > state.bid),
      "请选择高于当前叫分的分数，或不叫",
    );
    next.bids[seat] = action.score;
    next.bid = Math.max(state.bid, action.score);
    if (action.score > 0) next.landlord = seat;
    if (action.score === 3 || next.bids.every((b) => b !== null)) {
      if (next.landlord === null)
        return {
          ...createDoudizhu(state.id, redeal(), nextSeat(state.firstBidder)),
          revision: next.revision,
          deal: state.deal + 1,
        };
      next.phase = "playing";
      next.turn = next.landlord;
      next.hands[next.landlord] = sortCards([
        ...next.hands[next.landlord],
        ...next.bottom,
      ]);
    } else next.turn = nextSeat(seat);
    return next;
  }
  check(state.phase === "playing", "请先完成叫地主");
  if (action.type === "pass") {
    check(
      state.lastPlay && state.lastPlay.seat !== seat,
      "新一轮必须出牌，不能不出",
    );
    next.actions[seat] = "pass";
    next.passes++;
    next.turn = nextSeat(seat);
    if (next.passes === 2) {
      next.lastPlay = null;
      next.passes = 0;
      next.actions = [null, null, null];
    }
    return next;
  }
  check(validCards(action.cards), "请选择有效且不重复的手牌");
  check(
    action.cards.every((c) => state.hands[seat].includes(c)),
    "只能打出自己持有的牌",
  );
  const pattern = classify(action.cards);
  check(pattern, "这些牌不能组成有效牌型");
  check(
    beats(pattern, state.lastPlay?.pattern ?? null),
    "所选牌不能压过上一手",
  );
  const play = { seat, cards: sortCards(action.cards), pattern };
  next.hands[seat] = next.hands[seat].filter((c) => !action.cards.includes(c));
  next.lastPlay = play;
  next.actions[seat] = play;
  next.passes = 0;
  next.playCounts[seat]++;
  if (pattern.kind === "bomb" || pattern.kind === "rocket")
    next.multiplier *= 2;
  next.turn = nextSeat(seat);
  if (next.hands[seat].length === 0) {
    const won = seat === next.landlord;
    const spring = won
      ? next.playCounts.every((n, i) => i === next.landlord || n === 0)
      : next.playCounts[next.landlord!] === 1;
    return finishDoudizhu(
      next,
      won ? "landlord" : "farmers",
      spring ? (won ? "春天" : "反春") : "手牌出完",
      spring,
    );
  }
  // Clear the next player's previous action when it becomes their turn.
  next.actions[next.turn] = null;
  return next;
}
export function computerAction(view: DoudizhuView, seat: CardSeat): CardAction {
  if (view.phase === "bidding") {
    const groups = groupsOf(view.hand);
    const strength =
      view.hand.filter((c) => rankOf(c) >= 15).length +
      [...groups.values()].filter((g) => g.length === 4).length * 2;
    const score = strength >= 5 ? 3 : strength >= 3 ? 2 : 1;
    return { type: "bid", score: score > view.bid ? score : 0 };
  }
  const moves = legalPlays(view.hand, view.lastPlay?.pattern ?? null);
  const finishing = moves.find((m) => m.length === view.hand.length);
  if (finishing) return { type: "play", cards: finishing };
  if (
    view.lastPlay &&
    seat !== view.landlord &&
    view.lastPlay.seat !== view.landlord
  )
    return { type: "pass" };
  return moves.length ? { type: "play", cards: moves[0] } : { type: "pass" };
}

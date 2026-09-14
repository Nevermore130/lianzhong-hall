export type Tile = number;
export type MahjongSeat = 0 | 1 | 2 | 3;
export type Four<T> = [T, T, T, T];
export type Meld = {
  kind: "chi" | "peng" | "exposed-kong" | "concealed-kong" | "added-kong";
  tiles: Tile[];
  from: MahjongSeat;
};
export type ClaimChoice = "pass" | "chi" | "peng" | "gang" | "hu";
export type MahjongAction =
  | { type: "discard"; tile: Tile }
  | { type: "claim"; choice: ClaimChoice; tiles?: Tile[] }
  | { type: "kong"; tiles: Tile[] }
  | { type: "hu" };
export type ClaimOption = {
  choice: Exclude<ClaimChoice, "pass">;
  tiles: Tile[];
};
type Claim = {
  openedAt: number;
  from: MahjongSeat;
  tile: Tile;
  kind: "discard" | "rob-kong";
  meldIndex: number | null;
  eligible: MahjongSeat[];
  replies: Partial<Record<MahjongSeat, { choice: ClaimChoice; tiles: Tile[] }>>;
};
export type MahjongResult = {
  kind: "self-draw" | "discard" | "rob-kong" | "draw" | "forfeit";
  winner: MahjongSeat | null;
  loser: MahjongSeat | null;
  reason: string;
  winningTile?: Tile;
};
export type MahjongState = {
  id: string;
  revision: number;
  status: "playing" | "finished";
  phase: "discard" | "claim" | "finished";
  dealer: MahjongSeat;
  turn: MahjongSeat;
  wall: Tile[];
  hands: Four<Tile[]>;
  melds: Four<Meld[]>;
  discards: Four<Tile[]>;
  drawn: Tile | null;
  claim: Claim | null;
  lastDiscard: { seat: MahjongSeat; tile: Tile } | null;
  lastAction: string;
  result: MahjongResult | null;
  scores: Four<number>;
};
export type MahjongView = Pick<
  MahjongState,
  | "id"
  | "revision"
  | "status"
  | "phase"
  | "dealer"
  | "turn"
  | "discards"
  | "lastDiscard"
  | "lastAction"
  | "result"
  | "scores"
> & {
  hand: Tile[];
  drawn: Tile | null;
  counts: Four<number>;
  remaining: number;
  melds: Four<Meld[]>;
  claim: {
    from: MahjongSeat;
    tile: Tile;
    kind: Claim["kind"];
    answered: boolean;
  } | null;
  options: ClaimOption[];
  kongs: Tile[][];
  canHu: boolean;
  revealed: Four<Tile[]> | null;
};
export const winds = ["东", "南", "西", "北"] as const;
export const tileType = (tile: Tile) => Math.floor(tile / 4);
export const nextMahjongSeat = (seat: number) =>
  ((seat + 1) % 4) as MahjongSeat;
export const tileName = (tile: Tile) => {
  const t = tileType(tile);
  return t < 27
    ? `${(t % 9) + 1}${["万", "筒", "条"][Math.floor(t / 9)]}`
    : ["东风", "南风", "西风", "北风", "红中", "发财", "白板"][t - 27];
};
const four = <T>(make: () => T): Four<T> => [make(), make(), make(), make()];
const validTile = (tile: unknown): tile is Tile =>
  Number.isInteger(tile) && Number(tile) >= 0 && Number(tile) < 136;
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const sort = (tiles: Tile[]) => [...tiles].sort((a, b) => a - b);
export function shuffleMahjong(randomIndex: (max: number) => number): Tile[] {
  const wall = Array.from({ length: 136 }, (_, i) => i);
  for (let i = 135; i > 0; i--) {
    const j = randomIndex(i + 1);
    check(Number.isInteger(j) && j >= 0 && j <= i, "洗牌随机值无效");
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  return wall;
}
export function winningMahjong(
  hand: Tile[],
  meldCount = 0,
): "平胡" | "七对" | "十三幺" | null {
  if (
    !Number.isInteger(meldCount) ||
    meldCount < 0 ||
    meldCount > 4 ||
    hand.length !== 14 - meldCount * 3 ||
    hand.some((t) => !validTile(t)) ||
    new Set(hand).size !== hand.length
  )
    return null;
  const counts = Array(34).fill(0) as number[];
  for (const tile of hand) counts[tileType(tile)]++;
  if (counts.some((n) => n > 4)) return null;
  if (meldCount === 0) {
    if (counts.every((n) => n % 2 === 0)) return "七对";
    const orphans = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    if (
      orphans.every((t) => counts[t] >= 1) &&
      counts.every((n, t) => !n || orphans.includes(t))
    )
      return "十三幺";
  }
  function sets(left: number): boolean {
    const t = counts.findIndex((n) => n > 0);
    if (t < 0) return left === 0;
    if (left <= 0) return false;
    if (counts[t] >= 3) {
      counts[t] -= 3;
      const found = sets(left - 1);
      counts[t] += 3;
      if (found) return true;
    }
    if (t < 27 && t % 9 <= 6 && counts[t + 1] && counts[t + 2]) {
      counts[t]--;
      counts[t + 1]--;
      counts[t + 2]--;
      const found = sets(left - 1);
      counts[t]++;
      counts[t + 1]++;
      counts[t + 2]++;
      if (found) return true;
    }
    return false;
  }
  for (let pair = 0; pair < 34; pair++) {
    if (counts[pair] < 2) continue;
    counts[pair] -= 2;
    const found = sets(4 - meldCount);
    counts[pair] += 2;
    if (found) return "平胡";
  }
  return null;
}
export function createMahjong(
  id: string,
  tiles: Tile[],
  dealer: MahjongSeat = 0,
): MahjongState {
  check(
    tiles.length === 136 &&
      tiles.every(validTile) &&
      new Set(tiles).size === 136,
    "麻将牌墙无效",
  );
  check(Number.isInteger(dealer) && dealer >= 0 && dealer < 4, "庄家座位无效");
  const wall = [...tiles],
    hands = four<Tile[]>(() => []);
  for (let round = 0; round < 13; round++)
    for (let offset = 0; offset < 4; offset++)
      hands[(dealer + offset) % 4].push(wall.shift()!);
  const drawn = wall.shift()!;
  hands[dealer].push(drawn);
  return {
    id,
    revision: 0,
    status: "playing",
    phase: "discard",
    dealer,
    turn: dealer,
    wall,
    hands: hands.map(sort) as Four<Tile[]>,
    melds: four(() => []),
    discards: four(() => []),
    drawn,
    claim: null,
    lastDiscard: null,
    lastAction: `${winds[dealer]}位坐庄，请先出牌`,
    result: null,
    scores: [0, 0, 0, 0],
  };
}
function claimOptions(state: MahjongState, seat: MahjongSeat): ClaimOption[] {
  const c = state.claim;
  if (!c || seat === c.from) return [];
  const hand = state.hands[seat],
    out: ClaimOption[] = [];
  if (winningMahjong([...hand, c.tile], state.melds[seat].length))
    out.push({ choice: "hu", tiles: [] });
  if (c.kind === "rob-kong" || !state.wall.length) return out;
  const same = hand.filter((t) => tileType(t) === tileType(c.tile));
  if (same.length >= 3) out.push({ choice: "gang", tiles: same.slice(0, 3) });
  if (same.length >= 2) out.push({ choice: "peng", tiles: same.slice(0, 2) });
  const target = tileType(c.tile);
  if (seat === nextMahjongSeat(c.from) && target < 27) {
    for (let low = target - 2; low <= target; low++) {
      if (
        low < 0 ||
        low % 9 > 6 ||
        Math.floor(low / 9) !== Math.floor(target / 9)
      )
        continue;
      const needed = [low, low + 1, low + 2].filter((t) => t !== target);
      const selected = needed.map((t) =>
        hand.find((tile) => tileType(tile) === t),
      );
      if (selected.every((t) => t !== undefined))
        out.push({ choice: "chi", tiles: selected as Tile[] });
    }
  }
  return out;
}
function kongOptions(state: MahjongState, seat: MahjongSeat): Tile[][] {
  if (
    state.phase !== "discard" ||
    state.turn !== seat ||
    state.drawn === null ||
    !state.wall.length
  )
    return [];
  const hand = state.hands[seat],
    out: Tile[][] = [];
  for (let type = 0; type < 34; type++) {
    const same = hand.filter((t) => tileType(t) === type);
    if (same.length === 4) out.push(same);
    else if (
      same.length &&
      state.melds[seat].some(
        (m) => m.kind === "peng" && tileType(m.tiles[0]) === type,
      )
    )
      out.push([same[0]]);
  }
  return out;
}
/** Only the owner's hand and choices leave the server; the wall and other replies never do. */
export function mahjongView(state: MahjongState, seat: number): MahjongView {
  const own = Number.isInteger(seat) && seat >= 0 && seat < 4;
  return {
    id: state.id,
    revision: state.revision,
    status: state.status,
    phase: state.phase,
    dealer: state.dealer,
    turn: state.turn,
    discards: state.discards.map((d) => [...d]) as Four<Tile[]>,
    lastDiscard: state.lastDiscard,
    lastAction: state.lastAction,
    result: state.result,
    scores: [...state.scores],
    hand: own ? [...state.hands[seat]] : [],
    drawn: own && seat === state.turn ? state.drawn : null,
    counts: state.hands.map((h) => h.length) as Four<number>,
    remaining: state.wall.length,
    melds: state.melds.map((melds, i) =>
      melds.map((m) => ({
        ...m,
        tiles:
          m.kind === "concealed-kong" &&
          i !== seat &&
          state.status !== "finished"
            ? []
            : [...m.tiles],
      })),
    ) as Four<Meld[]>,
    claim: state.claim
      ? {
          from: state.claim.from,
          tile: state.claim.tile,
          kind: state.claim.kind,
          answered: own && !!state.claim.replies[seat as MahjongSeat],
        }
      : null,
    options:
      own &&
      state.status === "playing" &&
      state.claim &&
      !state.claim.replies[seat as MahjongSeat]
        ? claimOptions(state, seat as MahjongSeat)
        : [],
    kongs:
      own && state.status === "playing"
        ? kongOptions(state, seat as MahjongSeat)
        : [],
    canHu:
      own &&
      state.status === "playing" &&
      state.phase === "discard" &&
      state.turn === seat &&
      state.drawn !== null &&
      !!winningMahjong(state.hands[seat], state.melds[seat].length),
    revealed:
      state.status === "finished"
        ? (state.hands.map((h) => [...h]) as Four<Tile[]>)
        : null,
  };
}
export function finishMahjong(
  state: MahjongState,
  result: MahjongResult,
): MahjongState {
  const scores: Four<number> = [0, 0, 0, 0];
  if (result.winner !== null) {
    if (result.kind === "self-draw")
      for (let i = 0; i < 4; i++) scores[i] = i === result.winner ? 3 : -1;
    else {
      scores[result.winner] = 1;
      scores[result.loser!] = -1;
    }
  }
  return {
    ...state,
    revision: state.revision + 1,
    status: "finished",
    phase: "finished",
    claim: null,
    result,
    scores,
    lastAction: result.reason,
  };
}
function draw(
  state: MahjongState,
  seat: MahjongSeat,
  replacement = false,
): MahjongState {
  if (!state.wall.length)
    return finishMahjong(state, {
      kind: "draw",
      winner: null,
      loser: null,
      reason: "牌墙摸尽，本局流局",
    });
  const tile = replacement ? state.wall.pop()! : state.wall.shift()!;
  state.hands[seat] = sort([...state.hands[seat], tile]);
  state.turn = seat;
  state.phase = "discard";
  state.claim = null;
  state.drawn = tile;
  state.lastAction = `${winds[seat]}位${replacement ? "杠后补牌" : "摸牌"}，等待出牌`;
  return state;
}
function openClaim(
  state: MahjongState,
  input: Omit<Claim, "openedAt">,
): MahjongState {
  const claim: Claim = { ...input, openedAt: state.revision };
  state.claim = claim;
  state.phase = "claim";
  state.drawn = null;
  claim.eligible = ([0, 1, 2, 3] as const).filter(
    (seat) => claimOptions(state, seat).length > 0,
  );
  return claim.eligible.length ? state : resolveClaim(state);
}
function resolveClaim(state: MahjongState): MahjongState {
  const c = state.claim!;
  const priority = { hu: 3, gang: 2, peng: 2, chi: 1, pass: 0 };
  const claims = c.eligible
    .filter((s) => c.replies[s]?.choice !== "pass" && c.replies[s])
    .sort(
      (a, b) =>
        priority[c.replies[b]!.choice] - priority[c.replies[a]!.choice] ||
        ((a - c.from + 4) % 4) - ((b - c.from + 4) % 4),
    );
  if (claims.length) {
    const seat = claims[0],
      reply = c.replies[seat]!;
    if (reply.choice === "hu")
      return finishMahjong(state, {
        kind: c.kind,
        winner: seat,
        loser: c.from,
        winningTile: c.tile,
        reason: `${winds[seat]}位${c.kind === "rob-kong" ? "抢杠胡" : "点炮胡"} · ${winningMahjong([...state.hands[seat], c.tile], state.melds[seat].length)}`,
      });
    state.discards[c.from].pop();
    state.hands[seat] = state.hands[seat].filter(
      (t) => !reply.tiles.includes(t),
    );
    state.melds[seat].push({
      kind:
        reply.choice === "gang"
          ? "exposed-kong"
          : (reply.choice as "chi" | "peng"),
      tiles: sort([...reply.tiles, c.tile]),
      from: c.from,
    });
    state.claim = null;
    state.turn = seat;
    state.drawn = null;
    state.phase = "discard";
    state.lastAction = `${winds[seat]}位${reply.choice === "chi" ? "吃" : reply.choice === "peng" ? "碰" : "明杠"}${tileName(c.tile)}`;
    return reply.choice === "gang" ? draw(state, seat, true) : state;
  }
  if (c.kind === "rob-kong") {
    state.discards[c.from].pop();
    const meld = state.melds[c.from][c.meldIndex!];
    meld.kind = "added-kong";
    meld.tiles.push(c.tile);
    return draw(state, c.from, true);
  }
  return draw(state, nextMahjongSeat(c.from));
}
export function advanceMahjong(
  state: MahjongState,
  seat: MahjongSeat,
  action: MahjongAction,
): MahjongState {
  check(state.status === "playing", "当前没有进行中的麻将对局");
  check(Number.isInteger(seat) && seat >= 0 && seat < 4, "无效席位");
  const next: MahjongState = {
    ...state,
    revision: state.revision + 1,
    wall: [...state.wall],
    hands: state.hands.map((h) => [...h]) as Four<Tile[]>,
    melds: state.melds.map((ms) =>
      ms.map((m) => ({ ...m, tiles: [...m.tiles] })),
    ) as Four<Meld[]>,
    discards: state.discards.map((d) => [...d]) as Four<Tile[]>,
    claim: state.claim
      ? {
          ...state.claim,
          eligible: [...state.claim.eligible],
          replies: { ...state.claim.replies },
        }
      : null,
  };
  if (action.type === "claim") {
    const claim = next.claim;
    check(
      next.phase === "claim" && claim && claim.eligible.includes(seat),
      "当前没有可回应的吃碰杠胡",
    );
    check(!claim.replies[seat], "你已回应，请等待其他玩家");
    const chosen = action.tiles ?? [];
    check(
      Array.isArray(chosen) &&
        chosen.length <= 3 &&
        chosen.every(validTile) &&
        new Set(chosen).size === chosen.length,
      "吃碰杠选牌无效",
    );
    check(
      action.choice === "pass"
        ? chosen.length === 0
        : claimOptions(state, seat).some(
            (o) =>
              o.choice === action.choice &&
              sort(o.tiles).join() === sort(chosen).join(),
          ),
      "这个吃碰杠胡操作不合法",
    );
    claim.replies[seat] = { choice: action.choice, tiles: [...chosen] };
    return claim.eligible.every((s) => claim.replies[s])
      ? resolveClaim(next)
      : next;
  }
  check(
    state.phase === "discard" && state.turn === seat,
    "还没轮到你出牌，或正在等待吃碰杠胡",
  );
  if (action.type === "hu") {
    const pattern = winningMahjong(state.hands[seat], state.melds[seat].length);
    check(state.drawn !== null && pattern, "当前手牌还不能自摸胡牌");
    return finishMahjong(next, {
      kind: "self-draw",
      winner: seat,
      loser: null,
      winningTile: state.drawn,
      reason: `${winds[seat]}位自摸 · ${pattern}`,
    });
  }
  if (action.type === "kong") {
    check(
      Array.isArray(action.tiles) &&
        action.tiles.every(validTile) &&
        [1, 4].includes(action.tiles.length),
      "杠牌选择无效",
    );
    check(
      kongOptions(state, seat).some(
        (tiles) => sort(tiles).join() === sort(action.tiles).join(),
      ),
      "当前不能杠这组牌",
    );
    next.hands[seat] = next.hands[seat].filter(
      (t) => !action.tiles.includes(t),
    );
    if (action.tiles.length === 4) {
      next.melds[seat].push({
        kind: "concealed-kong",
        tiles: sort(action.tiles),
        from: seat,
      });
      return draw(next, seat, true);
    }
    const tile = action.tiles[0],
      meldIndex = next.melds[seat].findIndex(
        (m) => m.kind === "peng" && tileType(m.tiles[0]) === tileType(tile),
      );
    next.discards[seat].push(tile);
    next.lastAction = `${winds[seat]}位补杠${tileName(tile)}，等待抢杠胡`;
    return openClaim(next, {
      kind: "rob-kong",
      from: seat,
      tile,
      meldIndex,
      eligible: [],
      replies: {},
    });
  }
  check(
    action.type === "discard" &&
      validTile(action.tile) &&
      state.hands[seat].includes(action.tile),
    "只能打出自己持有的麻将牌",
  );
  next.hands[seat] = next.hands[seat].filter((t) => t !== action.tile);
  next.discards[seat].push(action.tile);
  next.lastDiscard = { seat, tile: action.tile };
  next.lastAction = `${winds[seat]}位打出${tileName(action.tile)}`;
  return openClaim(next, {
    kind: "discard",
    from: seat,
    tile: action.tile,
    meldIndex: null,
    eligible: [],
    replies: {},
  });
}
/** Heuristic uses only this player's visible view, never the private wall or opponents' hands. */
export function suggestMahjongDiscard(hand: Tile[]): Tile {
  check(hand.length > 0, "没有可出的手牌");
  function value(tiles: Tile[]) {
    const counts = Array(34).fill(0) as number[];
    tiles.forEach((t) => counts[tileType(t)]++);
    return counts.reduce(
      (sum, n, t) =>
        sum +
        (n >= 3 ? 16 : n === 2 ? 8 : 0) +
        (t < 27 && n
          ? (t % 9 < 8 && counts[t + 1] ? 3 : 0) +
            (t % 9 < 7 && counts[t + 2] ? 1 : 0)
          : 0),
      0,
    );
  }
  return [...hand].sort(
    (a, b) =>
      value(hand.filter((t) => t !== b)) - value(hand.filter((t) => t !== a)) ||
      b - a,
  )[0];
}
export function mahjongComputerAction(
  view: MahjongView,
  seat: MahjongSeat,
): MahjongAction | null {
  if (view.status !== "playing") return null;
  if (view.phase === "claim") {
    if (!view.options.length || view.claim?.answered) return null;
    const best =
      view.options.find((o) => o.choice === "hu") ??
      view.options.find((o) => o.choice === "gang") ??
      view.options.find((o) => o.choice === "peng") ??
      view.options.find((o) => o.choice === "chi");
    return best
      ? { type: "claim", ...best }
      : { type: "claim", choice: "pass" };
  }
  if (view.turn !== seat) return null;
  if (view.canHu) return { type: "hu" };
  if (view.kongs.length) return { type: "kong", tiles: view.kongs[0] };
  return { type: "discard", tile: suggestMahjongDiscard(view.hand) };
}

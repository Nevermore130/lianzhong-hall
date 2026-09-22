import { useEffect, useState, type CSSProperties } from "react";
import {
  cardLabel,
  classify,
  beats,
  legalPlays,
  patternNames,
  type Card,
  type CardAction,
  type DoudizhuView,
} from "../../shared/doudizhu.ts";
import { PlayingCard } from "./PlayingCard";
import { PlayerPortrait } from "./ClientArt";

export type CardPlayer = {
  name: string;
  avatar: number;
  online: boolean;
  ready: boolean;
} | null;
export function DoudizhuTable({
  match,
  players,
  ownSeat,
  connected,
  onAction,
  onSit,
}: {
  match: DoudizhuView | null;
  players: CardPlayer[];
  ownSeat: number;
  connected: boolean;
  onAction: (action: CardAction) => boolean;
  onSit?: (seat: 0 | 1 | 2) => void;
}) {
  const [selected, setSelected] = useState<Card[]>([]),
    [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const active = match?.status === "playing";
  const allOnline = players.every((p) => p?.online);
  const myTurn = !!active && match.turn === ownSeat && connected && allOnline;
  const playable = myTurn && match?.phase === "playing";
  const cards = match?.hand ?? [];
  const selectedCards = selected.filter((c) => cards.includes(c));
  const pattern = classify(selectedCards);
  const canPlay = !!pattern && beats(pattern, match?.lastPlay?.pattern ?? null);
  const lead = !match?.lastPlay;
  useEffect(() => {
    setSelected([]);
    setPending(false);
    setNotice("");
  }, [match?.id, match?.revision, ownSeat]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      setPending(false);
      setNotice("尚未确认，可重试；牌局更新后会自动同步。");
    }, 5000);
    return () => clearTimeout(timer);
  }, [pending]);
  function action(next: CardAction) {
    if (onAction(next)) {
      setPending(true);
      setNotice("");
    }
  }
  function hint() {
    const options = legalPlays(cards, match?.lastPlay?.pattern ?? null);
    if (!options.length) {
      setNotice("没有能压过上一手的牌，可以选择不出。");
      setSelected([]);
      return;
    }
    const key = [...selectedCards].sort((a, b) => a - b).join(",");
    const current = options.findIndex(
      (o) => [...o].sort((a, b) => a - b).join(",") === key,
    );
    setSelected(options[(current + 1) % options.length]);
    setNotice("");
  }
  const base = ownSeat < 0 ? 0 : ownSeat;
  const status = !match
    ? "三位玩家入座并准备后发牌"
    : match.status === "finished"
      ? match.winner
        ? (match.winner === "landlord" ? "地主获胜" : "农民获胜") +
          " · " +
          match.reason +
          " · 积分已更新"
        : match.reason
      : !allOnline
        ? "有人暂时离线，等待重连（保留 30 秒）"
        : match.phase === "bidding"
          ? myTurn
            ? "轮到你叫分"
            : players[match.turn]?.name + " 正在叫分"
          : myTurn
            ? lead
              ? "轮到你领出，不能不出"
              : "轮到你出牌"
            : players[match.turn]?.name + " 正在出牌";
  return (
    <div className="ddz-game">
      <div className="ddz-status" role="status">
        <i className={myTurn ? "your-turn" : ""} />
        {status}
        <span>
          底分 {match?.bid || "—"} · ×{match?.multiplier ?? 1}
        </span>
      </div>
      <div className="ddz-felt">
        <div className="ddz-bottom-cards" aria-label="地主底牌">
          <span>底牌</span>
          <div>
            {Array.from({ length: 3 }, (_, i) => (
              <PlayingCard
                key={i}
                card={match?.bottom[i]}
                back={!match?.bottom.length}
              />
            ))}
          </div>
          <small>
            {match?.phase === "bidding"
              ? "叫分后亮牌"
              : match?.landlord !== null && match?.landlord !== undefined
                ? "地主先出"
                : "经典三人"}
          </small>
        </div>
        {players.map((p, seat) => {
          const position =
            seat === base
              ? "bottom"
              : seat === (base + 1) % 3
                ? "right"
                : "left";
          const landlord = match?.landlord === seat;
          const previous = match?.actions[seat];
          return (
            <div
              key={seat}
              className={
                "ddz-player ddz-player-" +
                position +
                (active && match?.turn === seat ? " active-player" : "")
              }
            >
              <div className="ddz-player-heading">
                <PlayerPortrait avatar={p?.avatar ?? seat} />
                <div>
                  <strong>
                    {p?.name ?? "等待入座"}
                    {ownSeat === seat ? " [你]" : ""}
                  </strong>
                  <small>
                    {landlord ? (
                      <>
                        <img src="/assets/doudizhu-v1/landlord.svg" alt="" />
                        地主
                      </>
                    ) : match?.phase !== "bidding" &&
                      match?.landlord !== null &&
                      match ? (
                      "农民"
                    ) : (
                      seat + 1 + " 号位"
                    )}
                    {p && !p.online ? " · 离线" : ""}
                  </small>
                </div>
              </div>
              {p ? (
                <div className="ddz-player-state">
                  {active ? (
                    <>
                      <span className="ddz-card-count">
                        {match.counts[seat]} 张
                      </span>
                      <span>
                        {match.phase === "bidding"
                          ? match.bids[seat] === null
                            ? "等待叫分"
                            : match.bids[seat] === 0
                              ? "不叫"
                              : match.bids[seat] + " 分"
                          : previous === "pass"
                            ? "不出"
                            : previous
                              ? patternNames[previous.pattern.kind]
                              : ""}
                      </span>
                    </>
                  ) : match?.status === "finished" ? (
                    <span className={match.scores[seat] > 0 ? "score-win" : ""}>
                      本局 {match.scores[seat] > 0 ? "+" : ""}
                      {match.scores[seat]} 分
                    </span>
                  ) : (
                    <span>{p.ready ? "已准备" : "未准备"}</span>
                  )}
                </div>
              ) : (
                <button
                  disabled={!connected || !!active}
                  onClick={() => onSit?.(seat as 0 | 1 | 2)}
                  aria-label={"斗地主 " + (seat + 1) + " 号位入座"}
                >
                  入座
                </button>
              )}
            </div>
          );
        })}
        <div className="ddz-table-play">
          {match?.lastPlay ? (
            <>
              <div className="ddz-play-caption">
                {players[match.lastPlay.seat]?.name} ·{" "}
                {patternNames[match.lastPlay.pattern.kind]}
              </div>
              <div
                className="ddz-play-cards"
                style={
                  {
                    "--card-count": match.lastPlay.cards.length,
                  } as CSSProperties
                }
              >
                {match.lastPlay.cards.map((c) => (
                  <PlayingCard key={c} card={c} />
                ))}
              </div>
            </>
          ) : (
            <div className="ddz-table-label">
              <span>♠</span>
              <strong>
                {match?.phase === "bidding"
                  ? "叫 地 主"
                  : match?.status === "finished"
                    ? "本 局 结 束"
                    : "经 典 斗 地 主"}
              </strong>
              <small>
                {match?.phase === "bidding"
                  ? "不叫 / 1 分 / 2 分 / 3 分"
                  : match?.phase === "playing"
                    ? "新一轮 · 自由领出"
                    : "三人 · 54 张 · 自由桌"}
              </small>
              {(match?.deal ?? 1) > 1 && (
                <small>无人叫分，已重新发牌 · 第 {match!.deal} 次</small>
              )}
            </div>
          )}
        </div>
        <div className="ddz-table-footnote">
          {match?.spring ? "春天加倍 · " : ""}娱乐计分
        </div>
      </div>
      <div className="ddz-hand-area">
        <div className="ddz-hand-heading">
          <b>
            {ownSeat < 0 ? "旁观席" : "我的手牌"}
            {ownSeat >= 0 && match ? " · " + cards.length + " 张" : ""}
          </b>
          <span>
            {ownSeat < 0
              ? "玩家手牌不对旁观者公开"
              : active
                ? "点击选牌，再点「出牌」"
                : match
                  ? "点击准备再来一局"
                  : "准备后自动发牌"}
          </span>
        </div>
        {cards.length > 0 && (
          <div
            className="ddz-hand-scroll"
            tabIndex={0}
            role="region"
            aria-label="手牌区，可左右滑动"
          >
            <div
              className="ddz-hand"
              role="group"
              aria-label="我的手牌"
              style={{ "--card-count": cards.length } as CSSProperties}
            >
              {cards.map((card) => (
                <button
                  key={card}
                  className={
                    "ddz-hand-card" +
                    (selectedCards.includes(card) ? " selected" : "")
                  }
                  aria-label={cardLabel(card)}
                  aria-pressed={selectedCards.includes(card)}
                  disabled={!playable || pending}
                  onClick={() =>
                    setSelected((old) =>
                      old.includes(card)
                        ? old.filter((c) => c !== card)
                        : [...old, card],
                    )
                  }
                >
                  <PlayingCard card={card} />
                </button>
              ))}
            </div>
          </div>
        )}
        {cards.length > 0 && (
          <p className="ddz-swipe-hint">左右滑动查看手牌 · 点按选牌</p>
        )}
        {ownSeat >= 0 && match?.phase === "bidding" && active && (
          <div className="ddz-controls" aria-label="叫地主">
            {[0, 1, 2, 3].map((score) => (
              <button
                key={score}
                disabled={
                  !myTurn || pending || (score > 0 && score <= match.bid)
                }
                onClick={() => action({ type: "bid", score })}
              >
                {score === 0 ? "不叫" : score + " 分"}
              </button>
            ))}
          </div>
        )}
        {ownSeat >= 0 && match?.phase === "playing" && active && (
          <div className="ddz-controls" aria-label="出牌操作">
            <button
              disabled={!playable || pending || lead}
              onClick={() => action({ type: "pass" })}
            >
              不出
            </button>
            <button disabled={!playable || pending} onClick={hint}>
              提示
            </button>
            <button
              disabled={!selectedCards.length || pending}
              onClick={() => setSelected([])}
            >
              重选
            </button>
            <button
              className="primary"
              disabled={!playable || pending || !canPlay}
              onClick={() => action({ type: "play", cards: selectedCards })}
            >
              {pending ? "发送中…" : "出牌"}
            </button>
          </div>
        )}
        <div className="ddz-selection-info" role="status">
          {notice ||
            (selectedCards.length
              ? pattern
                ? canPlay
                  ? patternNames[pattern.kind]
                  : "这手牌压不过上一手"
                : "尚未组成有效牌型"
              : "")}
        </div>
      </div>
    </div>
  );
}

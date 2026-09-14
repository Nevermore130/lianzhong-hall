import { useEffect, useRef, useState } from "react";
import {
  winds,
  tileName,
  suggestMahjongDiscard,
  type MahjongAction,
  type MahjongSeat,
  type MahjongView,
} from "../../shared/mahjong.ts";
import { PlayerPortrait } from "./ClientArt";
import { MahjongTile } from "./MahjongTile";
import { MahjongRules } from "./MahjongRules";
import type { CardPlayer } from "./DoudizhuTable";
const labels = { chi: "吃", peng: "碰", gang: "杠", hu: "胡" };
const meldNames = {
  chi: "吃",
  peng: "碰",
  "exposed-kong": "明杠",
  "concealed-kong": "暗杠",
  "added-kong": "补杠",
};
export function MahjongTable({
  match,
  players,
  ownSeat,
  connected,
  onAction,
  onSit,
}: {
  match: MahjongView | null;
  players: CardPlayer[];
  ownSeat: number;
  connected: boolean;
  onAction: (action: MahjongAction) => boolean;
  onSit?: (seat: MahjongSeat) => void;
}) {
  const handRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (selected !== null)
      handRef.current
        ?.querySelector(`[data-tile="${selected}"]`)
        ?.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        });
  }, [selected]);
  const [pending, setPending] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    setSelected(null);
    setPending(false);
    setNotice("");
  }, [match?.id, match?.revision, ownSeat]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      setPending(false);
      setNotice("尚未确认，可重试；收到牌局更新后会自动同步。");
    }, 5000);
    return () => clearTimeout(timer);
  }, [pending]);
  const active = match?.status === "playing";
  const allOnline = players.every((p) => p?.online);
  const enabled = connected && allOnline && !pending && active && ownSeat >= 0;
  const myTurn =
    !!enabled && match.phase === "discard" && match.turn === ownSeat;
  const reacting =
    !!enabled && !!match.options.length && !match.claim?.answered;
  const base = ownSeat < 0 ? 0 : ownSeat;
  const hand = match?.hand ?? [];
  const displayHand = [
    ...hand.filter((t) => t !== match?.drawn),
    ...(match?.drawn !== null &&
    match?.drawn !== undefined &&
    hand.includes(match.drawn)
      ? [match.drawn]
      : []),
  ];
  const latest = match?.claim
    ? { seat: match.claim.from, tile: match.claim.tile }
    : match?.lastDiscard;
  const status = !match
    ? "四位玩家入座并准备后发牌"
    : !active
      ? match.lastAction
      : !connected
        ? "连接中，请稍候"
        : !allOnline
          ? "有人离线，暂停操作并保留座位 30 秒"
          : match.phase === "claim"
            ? match.claim?.answered
              ? "已回应，等待其他玩家"
              : match.options.length
                ? "请选择吃碰杠胡，或过牌"
                : "等待其他玩家回应"
            : match.turn === ownSeat
              ? "轮到你出牌"
              : `${players[match.turn]?.name ?? winds[match.turn]} 正在出牌`;
  function action(next: MahjongAction) {
    if (!enabled) return;
    if (onAction(next)) {
      setPending(true);
      setNotice("");
    } else setNotice("操作未发送，请检查连接或重新选择。");
  }
  return (
    <div className="mj-game">
      <div className="mj-status" role="status">
        <i className={myTurn || reacting ? "your-turn" : ""} />
        <strong>{status}</strong>
        <span>大众麻将 · 136 张</span>
      </div>
      <div className="mj-felt">
        {players.map((p, seat) => {
          const position = ["bottom", "right", "top", "left"][
            (seat - base + 4) % 4
          ];
          return (
            <div
              key={seat}
              className={`mj-player mj-player-${position}${active && match.turn === seat ? " active-player" : ""}`}
            >
              <div className="mj-player-heading">
                <span className="mj-wind">{winds[seat]}</span>
                <PlayerPortrait avatar={p?.avatar ?? seat} />
                <div>
                  <b>
                    {p?.name ?? "虚位以待"}
                    {seat === ownSeat ? " · 我" : ""}
                  </b>
                  <small>
                    {!p
                      ? "空座"
                      : !p.online
                        ? "离线"
                        : !active
                          ? p.ready
                            ? "已准备"
                            : "未准备"
                          : `${match.counts[seat]} 张手牌${match.dealer === seat ? " · 庄" : ""}`}
                  </small>
                </div>
              </div>
              {!p && onSit && (
                <button
                  disabled={!connected || !!active}
                  onClick={() => onSit(seat as MahjongSeat)}
                >
                  {winds[seat]}位入座
                </button>
              )}
              {p && active && seat !== ownSeat && (
                <div
                  className="mj-hidden-hand"
                  aria-label={`${winds[seat]}位手牌已隐藏`}
                >
                  {Array.from(
                    { length: Math.min(7, match.counts[seat]) },
                    (_, i) => (
                      <MahjongTile key={i} back />
                    ),
                  )}
                </div>
              )}
              {match?.melds[seat].map((m, i) => (
                <div className="mj-meld" key={i} title={meldNames[m.kind]}>
                  <small>{meldNames[m.kind]}</small>
                  {(m.tiles.length
                    ? m.tiles
                    : Array.from({ length: 4 }, () => undefined)
                  ).map((t, j) => (
                    <MahjongTile key={j} tile={t} />
                  ))}
                </div>
              ))}
              {match?.status === "finished" && (
                <span className="mj-score">
                  {match.result?.winner === seat ? "胡牌 · " : ""}
                  {match.scores[seat] > 0 ? "+" : ""}
                  {match.scores[seat]} 分
                </span>
              )}
            </div>
          );
        })}
        <div className="mj-center">
          <div className="mj-compass" aria-hidden="true">
            發
          </div>
          <small>
            牌墙余 <b>{match?.remaining ?? "—"}</b> 张
          </small>
          {latest ? (
            <>
              <div className="mj-last-tile">
                <MahjongTile tile={latest.tile} />
              </div>
              <span>
                {winds[latest.seat]}位 ·{" "}
                {match?.claim?.kind === "rob-kong" ? "补杠待定" : "最近出牌"}
              </span>
            </>
          ) : (
            <p>
              四方落座
              <br />
              以牌会友
            </p>
          )}
        </div>
      </div>
      {match && (
        <>
          <div className="mj-action-log">{match.lastAction}</div>
          {ownSeat >= 0 && (
            <div className="mj-hand-panel">
              <div className="mj-hand-title">
                <b>我的手牌 · {hand.length} 张</b>
                <span>
                  {myTurn ? "选牌后点击出牌" : "手牌自动整理"} · 可横向滑动
                </span>
              </div>
              <div
                ref={handRef}
                className="mj-hand-scroll"
                aria-label="我的麻将手牌"
              >
                {displayHand.map((t) => (
                  <button
                    key={t}
                    data-tile={t}
                    className={`mj-hand-tile${selected === t ? " selected" : ""}${match.drawn === t ? " drawn" : ""}`}
                    aria-label={`${tileName(t)}${match.drawn === t ? "，刚摸入" : ""}`}
                    aria-pressed={selected === t}
                    disabled={!myTurn}
                    onClick={() => setSelected(selected === t ? null : t)}
                  >
                    <MahjongTile tile={t} />
                  </button>
                ))}
              </div>
              {active && (
                <div className="mj-controls">
                  {match.phase === "discard" && (
                    <>
                      <button
                        className="primary"
                        disabled={
                          !myTurn ||
                          selected === null ||
                          !hand.includes(selected)
                        }
                        onClick={() =>
                          selected !== null &&
                          action({ type: "discard", tile: selected })
                        }
                      >
                        出牌
                        {selected !== null ? ` · ${tileName(selected)}` : ""}
                      </button>
                      <button
                        disabled={!myTurn}
                        onClick={() => {
                          setSelected(suggestMahjongDiscard(hand));
                          setNotice("提示仅参考自己的手牌，可自行调整。");
                        }}
                      >
                        提示
                      </button>
                      {match.canHu && (
                        <button
                          className="mj-hu"
                          disabled={!myTurn}
                          onClick={() => action({ type: "hu" })}
                        >
                          自摸胡牌
                        </button>
                      )}
                      {match.kongs.map((ts) => (
                        <button
                          key={ts.join()}
                          disabled={!myTurn}
                          onClick={() => action({ type: "kong", tiles: ts })}
                        >
                          {ts.length === 4 ? "暗杠" : "补杠"} ·{" "}
                          {tileName(ts[0])}
                        </button>
                      ))}
                    </>
                  )}
                  {match.options.map((o, i) => (
                    <button
                      key={i}
                      className={o.choice === "hu" ? "mj-hu" : ""}
                      disabled={!reacting}
                      onClick={() => action({ type: "claim", ...o })}
                    >
                      {labels[o.choice]}
                      {o.choice === "chi"
                        ? ` ${o.tiles.map(tileName).join("、")}`
                        : ""}
                    </button>
                  ))}
                  {match.options.length > 0 && (
                    <button
                      disabled={!reacting}
                      onClick={() => action({ type: "claim", choice: "pass" })}
                    >
                      过
                    </button>
                  )}
                  {pending && <span role="status">正在确认…</span>}
                  {match.phase === "claim" && !match.options.length && (
                    <span>{status}</span>
                  )}
                </div>
              )}
              {notice && (
                <p className="mj-notice" role="status">
                  {notice}
                </p>
              )}
            </div>
          )}
          {ownSeat < 0 && active && (
            <p className="mj-spectator">
              观战中 · 手牌与暗杠牌面保密，结束后亮牌
            </p>
          )}
          <details className="mj-rivers">
            <summary>牌河 · 查看各家已打出的牌</summary>
            <div className="mj-river-grid">
              {match.discards.map((tiles, seat) => (
                <div key={seat}>
                  <b>
                    {winds[seat]}位 · {tiles.length} 张
                  </b>
                  <div>
                    {tiles.map((t) => (
                      <MahjongTile key={t} tile={t} />
                    ))}
                    {!tiles.length && <small>暂无弃牌</small>}
                  </div>
                </div>
              ))}
            </div>
          </details>
          {match.revealed && (
            <details className="mj-reveal" open>
              <summary>本局结束 · 四家亮牌</summary>
              {match.revealed.map((tiles, seat) => (
                <div key={seat}>
                  <b>{winds[seat]}位</b>
                  <div>
                    {tiles.map((t) => (
                      <MahjongTile key={t} tile={t} />
                    ))}
                    {match.result?.winner === seat &&
                      match.result.kind !== "self-draw" &&
                      match.result.winningTile !== undefined && (
                        <span className="mj-winning-tile">
                          <MahjongTile tile={match.result.winningTile} />
                        </span>
                      )}
                  </div>
                </div>
              ))}
            </details>
          )}
        </>
      )}
      <details className="mj-rules">
        <summary>大众简化规则与计分</summary>
        <MahjongRules />
      </details>
    </div>
  );
}

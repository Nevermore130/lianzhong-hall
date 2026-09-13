import { useMemo, useState } from "react";
import type { Command, Snapshot, XiangqiRoom } from "../../shared/protocol.ts";
import {
  createXiangqi,
  inCheck,
  sideName,
  type XiangqiSide,
} from "../../shared/xiangqi.ts";
import { XiangqiPiece } from "./XiangqiPiece";
import { XiangqiPosition } from "./XiangqiPosition";
import { Modal } from "./Modal";
export function XiangqiRoomView({
  room,
  snapshot,
  send,
  connected,
}: {
  room: XiangqiRoom;
  snapshot: Snapshot;
  send: (command: Command) => boolean;
  connected: boolean;
}) {
  const [confirm, setConfirm] = useState<"leave" | "resign" | null>(null),
    [copied, setCopied] = useState(false),
    [flip, setFlip] = useState(false);
  const initial = useMemo(() => createXiangqi("waiting"), []);
  const match = room.match ?? initial,
    playing = room.match?.status === "playing";
  const ownSeat = room.seats.findIndex((s) => s?.userId === snapshot.me.id),
    side = (ownSeat === 1 ? 2 : 1) as XiangqiSide;
  const getPlayer = (id: string) => snapshot.players.find((p) => p.id === id);
  const bothOnline = room.seats.every((s) => s && getPlayer(s.userId)?.online),
    canAct = connected && bothOnline && ownSeat >= 0 && playing;
  const myTurn = canAct && match.turn === side;
  const version = { matchId: match.id, revision: match.revision };
  let status =
    ownSeat < 0
      ? "选择红方或黑方席位，双方准备后开始"
      : room.seats[ownSeat]?.ready
        ? "已准备，等待对手准备…"
        : "已入座，请点击准备开始";
  if (playing)
    status = !connected
      ? "连接中，暂不能走棋"
      : !bothOnline
        ? "对方暂时离线，保留座位 30 秒…"
        : `${sideName(match.turn)}走棋${ownSeat < 0 ? " · 观战中" : myTurn ? " · 轮到你了" : " · 等待对手"}${inCheck(match.board, match.turn) ? " · 将军！必须应将" : ""}`;
  if (match.status === "finished")
    status = `${match.winner === "draw" ? "本局和棋" : `${sideName(match.winner as XiangqiSide)}获胜`} · ${match.reason}`;
  return (
    <section className="room-view xq-room-view">
      <div className="room-view-heading">
        <button
          onClick={() =>
            playing && ownSeat >= 0
              ? setConfirm("leave")
              : send({ type: "leave" })
          }
        >
          ← 返回大厅
        </button>
        <span>
          中国象棋 / <b>{room.name}</b> / #{room.id}
        </span>
        <button
          aria-label="复制象棋房间邀请链接"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                location.origin + "/?room=" + room.id,
              );
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "已复制" : "邀请好友"}
        </button>
      </div>
      <div className="seats xq-seats">
        {room.seats.map((seat, i) => {
          const player = seat && getPlayer(seat.userId);
          return (
            <div
              className={`seat-card ${ownSeat === i ? "own-seat" : ""}`}
              key={i}
            >
              <XiangqiPiece piece={{ side: i === 0 ? 1 : 2, kind: "king" }} />
              <div>
                <strong>{player?.name ?? "等待玩家"}</strong>
                <small>
                  {i === 0 ? "执红先行" : "执黑后手"} ·{" "}
                  {player
                    ? !player.online
                      ? "重连中"
                      : playing
                        ? "对局中"
                        : seat?.ready
                          ? "已准备"
                          : "未准备"
                    : "空闲席位"}
                </small>
              </div>
              {!seat && (
                <button
                  disabled={playing || !connected}
                  aria-label={i === 0 ? "执红入座" : "执黑入座"}
                  onClick={() => send({ type: "sit", seat: i as 0 | 1 })}
                >
                  入座
                </button>
              )}
              {ownSeat === i && <span className="you-tag">你</span>}
            </div>
          );
        })}
      </div>
      <div
        className={`match-notice ${myTurn ? "your-turn" : ""}`}
        role="status"
      >
        {status}
      </div>
      {playing && match.drawOffer !== null && (
        <div className="xq-draw-offer" role="status">
          {ownSeat >= 0 && match.drawOffer !== side ? (
            <>
              <span>对手请求和棋，是否接受？</span>
              <button
                disabled={!canAct}
                onClick={() =>
                  send({ type: "xq:draw-response", accept: true, ...version })
                }
              >
                同意和棋
              </button>
              <button
                disabled={!canAct}
                onClick={() =>
                  send({ type: "xq:draw-response", accept: false, ...version })
                }
              >
                继续对局
              </button>
            </>
          ) : (
            `${sideName(match.drawOffer)}提出和棋，等待对方回应；继续走棋会撤销请求。`
          )}
        </div>
      )}
      <XiangqiPosition
        match={match}
        perspective={flip ? (side === 1 ? 2 : 1) : side}
        interactive={!!myTurn}
        onMove={(move) => send({ type: "xq:move", ...move, ...version })}
      />
      <div className="room-actions">
        <span>{room.watchers.length} 位观战</span>
        <button onClick={() => setFlip((v) => !v)}>翻转棋盘</button>
        {ownSeat >= 0 && !playing && (
          <>
            <button
              disabled={!connected}
              onClick={() => send({ type: "stand" })}
            >
              站起旁观
            </button>
            <button
              className="primary"
              disabled={!connected}
              onClick={() => send({ type: "ready" })}
            >
              {room.seats[ownSeat]?.ready
                ? "取消准备"
                : room.match
                  ? "再来一局 · 准备"
                  : "准备开始"}
            </button>
          </>
        )}
        {ownSeat >= 0 && playing && (
          <>
            <button
              disabled={!canAct || match.drawOffer !== null}
              onClick={() => send({ type: "xq:draw", ...version })}
            >
              求和
            </button>
            <button disabled={!connected} onClick={() => setConfirm("resign")}>
              认输
            </button>
          </>
        )}
      </div>
      {confirm && (
        <Modal
          title={confirm === "leave" ? "离开棋局" : "确认认输"}
          close={() => setConfirm(null)}
        >
          <p>
            棋局正在进行，{confirm === "leave" ? "离开房间" : "认输"}
            将判本局负。
          </p>
          <div className="dialog-actions">
            <button onClick={() => setConfirm(null)}>继续下棋</button>
            <button
              onClick={() => {
                if (send({ type: confirm })) setConfirm(null);
              }}
            >
              确认{confirm === "leave" ? "离开" : "认输"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

import { ArrowLeft, Copy, Eye, Flag, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { Command, GomokuRoom, Snapshot } from "../../shared/protocol.ts";
import { newBoard } from "../../shared/gomoku.ts";
import { Board } from "./Board";
import { GomokuStone } from "./GomokuStone";
import { Modal } from "./Modal";
import type { SoundManager } from "../lib/sound";
import type { BGMManager } from "../lib/bgm";
export function RoomView({
  room,
  snapshot,
  send,
  connected,
  bgmManager,
}: {
  room: GomokuRoom;
  snapshot: Snapshot;
  send: (command: Command) => boolean;
  connected: boolean;
  soundManager?: SoundManager;
  bgmManager?: BGMManager;
}) {
  const [confirm, setConfirm] = useState<"leave" | "resign" | null>(null),
    [copied, setCopied] = useState(false);
  const ownSeat = room.seats.findIndex((s) => s?.userId === snapshot.me.id),
    playing = room.match?.status === "playing";
  useEffect(() => {
    bgmManager?.play("gomoku");
    return () => {
      bgmManager?.stop();
    };
  }, [bgmManager]);
  const getPlayer = (id: string) => snapshot.players.find((p) => p.id === id);
  const bothOnline = room.seats.every((s) => s && getPlayer(s.userId)?.online);
  const myTurn =
    playing && room.match!.turn === ownSeat + 1 && bothOnline && connected;
  let status = "选一个座位，准备开始";
  if (ownSeat >= 0)
    status = room.seats[ownSeat]?.ready
      ? "已准备，等待对手准备…"
      : "你已入座，点击准备开始";
  if (playing)
    status = !bothOnline
      ? "对方暂时离线，保留座位 30 秒…"
      : ownSeat < 0
        ? `${room.match!.turn === 1 ? "黑" : "白"}棋思考中 · 观战`
        : myTurn
          ? "轮到你了，点击棋盘落子"
          : "对手正在思考…";
  if (room.match?.status === "finished")
    status =
      room.match.winner === "draw"
        ? "本局和棋 · 双方准备可再来一局"
        : `${room.match.winner === 1 ? "黑" : "白"}棋获胜 · ${room.match.reason} · 积分已更新`;
  return (
    <section className="room-view">
      <div className="room-view-heading">
        <button
          onClick={() =>
            playing && ownSeat >= 0
              ? setConfirm("leave")
              : send({ type: "leave" })
          }
        >
          <ArrowLeft size={14} />
          返回大厅
        </button>
        <span>
          五子棋 / <b>{room.name}</b> / #{room.id}
        </span>
        <button
          aria-label="复制房间邀请链接"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                `${location.origin}/?room=${room.id}`,
              );
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? (
            "已复制"
          ) : (
            <>
              <Copy size={13} />
              邀请好友
            </>
          )}
        </button>
      </div>
      <div className="seats">
        {room.seats.map((seat, i) => {
          const player = seat && getPlayer(seat.userId);
          return (
            <div
              key={i}
              className={`seat-card ${ownSeat === i ? "own-seat" : ""}`}
            >
              <GomokuStone stone={i === 0 ? 1 : 2} />
              <div>
                <strong>{player?.name ?? "等待玩家"}</strong>
                <small>
                  {player
                    ? `${i === 0 ? "执黑先行" : "执白后手"} · ${player.online ? (playing ? "对局中" : seat?.ready ? "已准备" : "未准备") : "重连中"}`
                    : "空闲座位"}
                </small>
              </div>
              {!seat && (
                <button
                  aria-label={i === 0 ? "执黑入座" : "执白入座"}
                  disabled={playing || !connected}
                  onClick={() => send({ type: "sit", seat: i as 0 | 1 })}
                >
                  <UserRound size={13} />
                  入座
                </button>
              )}
              {seat?.userId === snapshot.me.id && (
                <span className="you-tag">你</span>
              )}
            </div>
          );
        })}
      </div>
      <div
        className={`match-notice ${myTurn ? "your-turn" : ""}`}
        role="status"
      >
        <i className={`status-dot ${connected ? "" : "disconnected"}`} />
        {status}
        <span>自由规则 · 连五即胜</span>
      </div>
      <Board
        board={room.match?.board ?? newBoard()}
        lastMove={room.match?.lastMove ?? null}
        disabled={!myTurn}
        previewStone={ownSeat === 1 ? 2 : 1}
        onMove={(index) =>
          send({ type: "move", index, matchId: room.match!.id })
        }
      />
      <div className="room-actions">
        <span>
          <Eye size={14} />
          {room.watchers.length} 位观战
        </span>
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
          <button disabled={!connected} onClick={() => setConfirm("resign")}>
            <Flag size={14} />
            认输
          </button>
        )}
      </div>
      {confirm && (
        <Modal
          title={confirm === "resign" ? "确认认输" : "离开对局"}
          close={() => setConfirm(null)}
        >
          <p>
            当前对局正在进行。{confirm === "resign" ? "认输" : "离开"}
            会判定本局负，是否继续？
          </p>
          <div className="dialog-actions">
            <button onClick={() => setConfirm(null)}>继续下棋</button>
            <button
              className="primary"
              onClick={() => {
                send({ type: confirm });
                setConfirm(null);
              }}
            >
              {confirm === "resign" ? "确认认输" : "离开房间"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

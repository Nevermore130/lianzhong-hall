import { useState } from "react";
import type { Command, DoudizhuRoom, Snapshot } from "../../shared/protocol.ts";
import { DoudizhuTable } from "./DoudizhuTable";
import { Modal } from "./Modal";
import type { CardAction } from "../../shared/doudizhu.ts";
import type { SoundManager } from "../lib/sound";
export function DoudizhuRoomView({
  room,
  snapshot,
  send,
  connected,
  soundManager,
}: {
  room: DoudizhuRoom;
  snapshot: Snapshot;
  send: (command: Command) => boolean;
  connected: boolean;
  soundManager: SoundManager;
}) {
  const [confirm, setConfirm] = useState<"leave" | "resign" | null>(null),
    [copied, setCopied] = useState(false);
  const ownSeat = room.seats.findIndex((s) => s?.userId === snapshot.me.id),
    active = room.match?.status === "playing";
  const players = room.seats.map((seat) => {
    const p = snapshot.players.find((p) => p.id === seat?.userId);
    return seat && p
      ? { name: p.name, avatar: p.avatar, online: p.online, ready: seat.ready }
      : null;
  });
  function action(a: CardAction) {
    if (!room.match) return false;
    const version = { matchId: room.match.id, revision: room.match.revision };
    const result =
      a.type === "bid"
        ? send({ type: "ddz:bid", score: a.score, ...version })
        : a.type === "play"
          ? send({ type: "ddz:play", cards: a.cards, ...version })
          : send({ type: "ddz:pass", ...version });

    if (result) {
      if (a.type === "bid" && a.score > 0) {
        soundManager.play("claim");
      } else if (a.type === "play") {
        soundManager.play("play");
      } else if (a.type === "pass") {
        soundManager.play("pass");
      }
    }

    return result;
  }
  return (
    <section className="room-view ddz-room-view">
      <div className="room-view-heading">
        <button
          onClick={() =>
            active && ownSeat >= 0
              ? setConfirm("leave")
              : send({ type: "leave" })
          }
        >
          ← 返回大厅
        </button>
        <span>
          斗地主 / <b>{room.name}</b> / #{room.id}
        </span>
        <button
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
      <DoudizhuTable
        match={room.match}
        players={players}
        ownSeat={ownSeat}
        connected={connected}
        onAction={action}
        onSit={(seat) => send({ type: "sit", seat })}
      />
      <div className="room-actions">
        <span>{room.watchers.length} 位观战</span>
        {ownSeat >= 0 && !active && (
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
              {room.seats[ownSeat]?.ready ? "取消准备" : "准备开始"}
            </button>
          </>
        )}
        {ownSeat >= 0 && active && (
          <button disabled={!connected} onClick={() => setConfirm("resign")}>
            {room.match?.phase === "bidding" ? "取消本局" : "认输"}
          </button>
        )}
      </div>
      {confirm && (
        <Modal title="离开牌局" close={() => setConfirm(null)}>
          <p>
            {room.match?.phase === "bidding"
              ? "叫分阶段退出将取消本局，不计战绩。"
              : "牌局已经开始，退出或认输会判所在一方负；农民退出也会影响队友。"}
          </p>
          <div className="dialog-actions">
            <button onClick={() => setConfirm(null)}>继续游戏</button>
            <button
              onClick={() => {
                send({ type: confirm });
                setConfirm(null);
              }}
            >
              确认{confirm === "leave" ? "离开" : "退出本局"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

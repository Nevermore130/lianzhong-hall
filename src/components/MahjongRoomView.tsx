import { useEffect, useState } from "react";
import type { Command, MahjongRoom, Snapshot } from "../../shared/protocol.ts";
import { MahjongTable } from "./MahjongTable";
import { Modal } from "./Modal";
import type { MahjongAction } from "../../shared/mahjong.ts";
import type { SoundManager } from "../lib/sound";
import type { BGMManager } from "../lib/bgm";
export function MahjongRoomView({
  room,
  snapshot,
  send,
  connected,
  soundManager,
  bgmManager,
}: {
  room: MahjongRoom;
  snapshot: Snapshot;
  send: (command: Command) => boolean;
  connected: boolean;
  soundManager: SoundManager;
  bgmManager?: BGMManager;
}) {
  const [confirm, setConfirm] = useState<"leave" | "resign" | null>(null),
    [copied, setCopied] = useState(false);
  const ownSeat = room.seats.findIndex((s) => s?.userId === snapshot.me.id),
    active = room.match?.status === "playing";
  useEffect(() => {
    bgmManager?.play("mahjong");
    return () => {
      bgmManager?.stop();
    };
  }, [bgmManager]);
  const players = room.seats.map((seat) => {
    const p = snapshot.players.find((p) => p.id === seat?.userId);
    return seat && p
      ? { name: p.name, avatar: p.avatar, online: p.online, ready: seat.ready }
      : null;
  });
  function action(a: MahjongAction) {
    if (!room.match) return false;
    const version = { matchId: room.match.id, revision: room.match.revision };
    const result = send({ type: "mj:action", action: a, ...version });

    if (result) {
      if (a.type === "discard") {
        soundManager.play("place");
      } else if (a.type === "claim") {
        if (a.choice === "pass") {
          soundManager.play("pass");
        } else if (a.choice === "hu") {
          soundManager.play("claim");
        } else {
          soundManager.play("capture");
        }
      } else if (a.type === "kong") {
        soundManager.play("capture");
      } else if (a.type === "hu") {
        soundManager.play("claim");
      }
    }

    return result;
  }
  return (
    <section className="room-view mj-room-view">
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
          中国麻将 / <b>{room.name}</b> / #{room.id}
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
      <MahjongTable
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
            结束本局
          </button>
        )}
      </div>
      {confirm && (
        <Modal title="离开牌局" close={() => setConfirm(null)}>
          <p>
            四人牌局已经开始。离开或结束会中止本局，仅退出者记负，其他人不计胜负，所有人的娱乐分为
            0。
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

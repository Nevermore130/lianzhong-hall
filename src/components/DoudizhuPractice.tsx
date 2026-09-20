import { useEffect, useState } from "react";
import {
  advanceDoudizhu,
  computerAction,
  createDoudizhu,
  doudizhuView,
  shuffleDeck,
  type CardAction,
} from "../../shared/doudizhu.ts";
import { generateUUID } from "../lib/uuid";
import { DoudizhuTable } from "./DoudizhuTable";
import { Modal } from "./Modal";
import type { SoundManager } from "../lib/sound";
import type { BGMManager } from "../lib/bgm.ts";
const deck = () => shuffleDeck((max) => Math.floor(Math.random() * max));
const start = () => createDoudizhu(generateUUID(), deck());
const players = [
  { name: "你", avatar: 0, online: true, ready: true },
  { name: "电脑 · 小梅", avatar: 1, online: true, ready: true },
  { name: "电脑 · 老陈", avatar: 2, online: true, ready: true },
];
export function DoudizhuPractice({
  close,
  soundManager,
  bgmManager,
}: {
  close: () => void;
  soundManager: SoundManager;
  bgmManager: BGMManager;
}) {
  const [match, setMatch] = useState(start);
  useEffect(() => {
    bgmManager.play("doudizhu");
    return () => {
      bgmManager.stop();
    };
  }, [bgmManager]);
  useEffect(() => {
    if (match.status === "finished" || match.turn === 0) return;
    const timer = setTimeout(() => {
      const computerAct = computerAction(
        doudizhuView(match, match.turn),
        match.turn,
      );
      setMatch((old) => {
        if (old !== match) return old;
        const next = advanceDoudizhu(old, old.turn, computerAct, deck);
        if (computerAct.type === "bid" && computerAct.score > 0) {
          soundManager.play("claim");
        } else if (computerAct.type === "play") {
          soundManager.play("play");
        } else if (computerAct.type === "pass") {
          soundManager.play("pass");
        }
        return next;
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [match, soundManager]);
  function action(a: CardAction) {
    try {
      setMatch(advanceDoudizhu(match, 0, a, deck));
      if (a.type === "bid" && a.score > 0) {
        soundManager.play("claim");
      } else if (a.type === "play") {
        soundManager.play("play");
      } else if (a.type === "pass") {
        soundManager.play("pass");
      }
      return true;
    } catch {
      return false;
    }
  }
  return (
    <Modal title="斗地主 · 单机练习" close={close} wide>
      <div className="ddz-practice-header">
        <strong>经典斗地主</strong>
        <span>两位电脑陪练 · 不计账号战绩</span>
      </div>
      <DoudizhuTable
        match={doudizhuView(match, 0)}
        players={players}
        ownSeat={0}
        connected
        onAction={action}
      />
      <div className="dialog-actions">
        <button onClick={() => setMatch(start())}>重新发牌</button>
        <button onClick={close}>返回大厅</button>
      </div>
    </Modal>
  );
}

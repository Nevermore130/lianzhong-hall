import { useEffect, useState } from "react";
import {
  advanceDoudizhu,
  computerAction,
  createDoudizhu,
  doudizhuView,
  shuffleDeck,
  type CardAction,
} from "../../shared/doudizhu.ts";
import { DoudizhuTable } from "./DoudizhuTable";
import { Modal } from "./Modal";
const deck = () => shuffleDeck((max) => Math.floor(Math.random() * max));
const start = () => createDoudizhu(crypto.randomUUID(), deck());
const players = [
  { name: "你", avatar: 0, online: true, ready: true },
  { name: "电脑 · 小梅", avatar: 1, online: true, ready: true },
  { name: "电脑 · 老陈", avatar: 2, online: true, ready: true },
];
export function DoudizhuPractice({ close }: { close: () => void }) {
  const [match, setMatch] = useState(start);
  useEffect(() => {
    if (match.status === "finished" || match.turn === 0) return;
    const timer = setTimeout(
      () =>
        setMatch((old) =>
          old !== match
            ? old
            : advanceDoudizhu(
                old,
                old.turn,
                computerAction(doudizhuView(old, old.turn), old.turn),
                deck,
              ),
        ),
      800,
    );
    return () => clearTimeout(timer);
  }, [match]);
  function action(a: CardAction) {
    try {
      setMatch(advanceDoudizhu(match, 0, a, deck));
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

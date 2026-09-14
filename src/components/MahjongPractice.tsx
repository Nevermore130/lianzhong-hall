import { useEffect, useState } from "react";
import {
  advanceMahjong,
  createMahjong,
  mahjongComputerAction,
  mahjongView,
  shuffleMahjong,
  type MahjongAction,
} from "../../shared/mahjong.ts";
import { MahjongTable } from "./MahjongTable";
import { Modal } from "./Modal";
const start = () =>
  createMahjong(
    crypto.randomUUID(),
    shuffleMahjong((max) => Math.floor(Math.random() * max)),
  );
const players = [
  { name: "你", avatar: 0, online: true, ready: true },
  { name: "电脑 · 小梅", avatar: 1, online: true, ready: true },
  { name: "电脑 · 老陈", avatar: 2, online: true, ready: true },
  { name: "电脑 · 阿芳", avatar: 3, online: true, ready: true },
];
export function MahjongPractice({ close }: { close: () => void }) {
  const [match, setMatch] = useState(start);
  useEffect(() => {
    const seat = ([1, 2, 3] as const).find((s) =>
      mahjongComputerAction(mahjongView(match, s), s),
    );
    if (seat === undefined) return;
    const timer = setTimeout(
      () =>
        setMatch((old) => {
          if (old !== match) return old;
          const action = mahjongComputerAction(mahjongView(old, seat), seat);
          return action ? advanceMahjong(old, seat, action) : old;
        }),
      650,
    );
    return () => clearTimeout(timer);
  }, [match]);
  function action(a: MahjongAction) {
    try {
      setMatch(advanceMahjong(match, 0, a));
      return true;
    } catch {
      return false;
    }
  }
  return (
    <Modal title="中国麻将 · 单机练习" close={close} wide>
      <div className="mj-practice-header">
        <strong>中国麻将</strong>
        <span>三位电脑陪练 · 不计账号战绩</span>
      </div>
      <MahjongTable
        match={mahjongView(match, 0)}
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

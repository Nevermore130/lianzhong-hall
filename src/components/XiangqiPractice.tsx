import { useEffect, useState } from "react";
import {
  advanceXiangqi,
  chooseXiangqiMove,
  createXiangqi,
  inCheck,
  sideName,
  squareName,
  type XiangqiAction,
  type XiangqiSide,
  type XiangqiState,
} from "../../shared/xiangqi.ts";
import { generateUUID } from "../lib/uuid";
import { Modal } from "./Modal";
import { XiangqiPosition } from "./XiangqiPosition";
import type { SoundManager } from "../lib/sound";
export function XiangqiPractice({
  close,
  soundManager,
}: {
  close: () => void;
  soundManager: SoundManager;
}) {
  const [match, setMatch] = useState(() => createXiangqi(generateUUID()));
  const [previous, setPrevious] = useState<XiangqiState[]>([]),
    [side, setSide] = useState<XiangqiSide>(1),
    [depth, setDepth] = useState(2);
  const [hint, setHint] = useState<XiangqiAction | null>(null),
    [workerError, setWorkerError] = useState(false),
    [retry, setRetry] = useState(0);
  const myTurn = match.status === "playing" && match.turn === side;
  useEffect(() => {
    if (match.status !== "playing" || match.turn === side) return;
    const worker = new Worker(
      new URL("../lib/xiangqi-worker.ts", import.meta.url),
      { type: "module" },
    );
    let cancelled = false;
    worker.onmessage = (event: MessageEvent<XiangqiAction | null>) => {
      if (cancelled || !event.data) return;
      const isCapture = match.board[event.data.to] !== null;
      const next = advanceXiangqi(match, match.turn, event.data);
      setPrevious((old) => [...old, match]);
      setMatch(next);
      setWorkerError(false);
      soundManager.play(isCapture ? "capture" : "place");
    };
    worker.onerror = () => {
      if (!cancelled) setWorkerError(true);
    };
    const timer = setTimeout(() => worker.postMessage({ match, depth }), 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      worker.terminate();
    };
  }, [match, side, depth, retry]);
  function reset(nextSide = side) {
    setSide(nextSide);
    setMatch(createXiangqi(generateUUID()));
    setPrevious([]);
    setHint(null);
    setWorkerError(false);
  }
  function move(action: XiangqiAction) {
    if (!myTurn) return;
    const isCapture = match.board[action.to] !== null;
    const next = advanceXiangqi(match, side, action);
    setPrevious((old) => [...old, match]);
    setMatch(next);
    setHint(null);
    soundManager.play(isCapture ? "capture" : "place");
  }
  const undoIndex = previous.map((s) => s.turn).lastIndexOf(side);
  const notice =
    match.status === "finished"
      ? `${match.winner === "draw" ? "本局和棋" : match.winner === side ? "你赢了" : "电脑获胜"} · ${match.reason}`
      : workerError
        ? "电脑思考失败，请重试"
        : myTurn
          ? `轮到你了 · ${inCheck(match.board, side) ? "将军！请选择应将走法" : "先选棋子，再点可走位置"}`
          : "电脑正在思考…";
  return (
    <Modal title="中国象棋 · 单机练习" close={close} wide>
      <div className="practice-title">
        <div>
          <h2>中国象棋人机对局</h2>
          <p>你执{side === 1 ? "红" : "黑"} · 红先黑后 · 不计战绩</p>
        </div>
        <span className="pill">单机</span>
      </div>
      <div className="xq-practice-options">
        <label>
          执方（新局）
          <select
            value={side}
            onChange={(e) => reset(Number(e.target.value) as XiangqiSide)}
          >
            <option value={1}>红方先行</option>
            <option value={2}>黑方后手</option>
          </select>
        </label>
        <label>
          电脑难度
          <select
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
          >
            <option value={1}>入门</option>
            <option value={2}>普通</option>
          </select>
        </label>
        <span>娱乐规则</span>
      </div>
      <div
        className={`match-notice ${myTurn ? "your-turn" : ""}`}
        role="status"
      >
        {notice}
      </div>
      <XiangqiPosition
        match={match}
        perspective={side}
        interactive={myTurn}
        onMove={move}
        hint={hint}
      />
      <div className="xq-hint" role="status">
        {hint
          ? `建议 ${squareName(hint.from)} → ${squareName(hint.to)}；点击棋子走棋。`
          : `${sideName(match.turn)}${match.status === "finished" ? "最后应走" : "走棋"} · 支持方向键移动焦点、回车选子`}
      </div>
      <div className="dialog-actions xq-practice-actions">
        {workerError && (
          <button
            onClick={() => {
              setWorkerError(false);
              setRetry((v) => v + 1);
            }}
          >
            重试电脑
          </button>
        )}
        <button
          disabled={!myTurn}
          onClick={() => setHint(chooseXiangqiMove(match, 1))}
        >
          提示走法
        </button>
        <button
          disabled={undoIndex < 0}
          onClick={() => {
            if (undoIndex >= 0) {
              setMatch(previous[undoIndex]);
              setPrevious(previous.slice(0, undoIndex));
              setHint(null);
              setWorkerError(false);
            }
          }}
        >
          悔棋一回合
        </button>
        <button onClick={() => reset()}>重新开局</button>
        <button onClick={close}>返回大厅</button>
      </div>
    </Modal>
  );
}

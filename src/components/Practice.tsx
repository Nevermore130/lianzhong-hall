import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  chooseComputerMove,
  isWin,
  newBoard,
  placeStone,
} from "../../shared/gomoku.ts";
import { Board } from "./Board";
import { Modal } from "./Modal";
import type { SoundManager } from "../lib/sound";
import type { BGMManager } from "../lib/bgm";
export function Practice({
  close,
  soundManager,
  bgmManager,
}: {
  close: () => void;
  soundManager: SoundManager;
  bgmManager: BGMManager;
}) {
  const [board, setBoard] = useState(newBoard),
    [turn, setTurn] = useState<1 | 2>(1),
    [last, setLast] = useState<number | null>(null);
  const won = last !== null && isWin(board, last) ? board[last] : null,
    draw = !won && board.every(Boolean);
  useEffect(() => {
    bgmManager.play("gomoku");
    return () => {
      bgmManager.stop();
    };
  }, [bgmManager]);
  useEffect(() => {
    if (turn !== 2 || won || draw) return;
    const timer = setTimeout(() => {
      const index = chooseComputerMove(board);
      if (index === null) return;
      setBoard(placeStone(board, index, 2)!);
      setLast(index);
      setTurn(1);
      soundManager.play("place");
    }, 450);
    return () => clearTimeout(timer);
  }, [turn, board, won, draw, soundManager]);
  function move(index: number) {
    if (turn !== 1 || won || draw) return;
    const next = placeStone(board, index, 1);
    if (next) {
      setBoard(next);
      setLast(index);
      setTurn(2);
      soundManager.play("place");
    }
  }
  return (
    <Modal title="五子棋 · 单机练习" close={close} wide>
      <div className="practice-title">
        <div>
          <h2>五子棋人机对局</h2>
          <p>自由五子棋 · 你执黑先行 · 不计战绩</p>
        </div>
        <span className="pill">单机</span>
      </div>
      <div className="match-notice" role="status">
        {won
          ? won === 1
            ? "恭喜，你赢了！再来一盘？"
            : "电脑获胜，下盘再战。"
          : draw
            ? "棋盘已满，本局和棋。"
            : turn === 1
              ? "● 轮到你了，点击棋盘落子"
              : "○ 电脑正在想下一步…"}
      </div>
      <Board
        board={board}
        lastMove={last}
        disabled={turn !== 1 || !!won || draw}
        onMove={move}
      />
      <div className="dialog-actions">
        <button
          onClick={() => {
            setBoard(newBoard());
            setLast(null);
            setTurn(1);
          }}
        >
          <RotateCcw size={14} />
          重新开始
        </button>
        <button onClick={close}>返回大厅</button>
      </div>
    </Modal>
  );
}

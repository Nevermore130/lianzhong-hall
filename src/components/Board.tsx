import type { Board as BoardType } from "../../shared/gomoku.ts";
export function Board({
  board,
  lastMove,
  disabled,
  onMove,
}: {
  board: BoardType;
  lastMove: number | null;
  disabled: boolean;
  onMove: (index: number) => void;
}) {
  return (
    <div className="board-frame">
      <div className="board-coordinates" aria-hidden="true">
        {"ABCDEFGHIJKLMNO".split("").map((letter) => (
          <span key={letter}>{letter}</span>
        ))}
      </div>
      <div
        className="gomoku-board"
        role="group"
        aria-label="15 乘 15 五子棋棋盘"
      >
        {board.map((stone, index) => (
          <button
            key={index}
            className={`point ${stone === 1 ? "has-black" : stone === 2 ? "has-white" : ""} ${lastMove === index ? "last-move" : ""} ${[48, 56, 112, 168, 176].includes(index) ? "star-point" : ""}`}
            disabled={disabled || stone !== 0}
            aria-label={`${String.fromCharCode(65 + (index % 15))}${Math.floor(index / 15) + 1}${stone ? (stone === 1 ? " 黑棋" : " 白棋") : " 空位"}`}
            onClick={() => onMove(index)}
          >
            <span />
          </button>
        ))}
      </div>
    </div>
  );
}

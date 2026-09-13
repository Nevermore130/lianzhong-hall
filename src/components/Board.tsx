import { SIZE, type Board as BoardType } from "../../shared/gomoku.ts";
import { GomokuStone } from "./GomokuStone";

const coordinates = Array.from({ length: SIZE }, (_, index) => index);
const stars = [
  [3, 3],
  [11, 3],
  [7, 7],
  [3, 11],
  [11, 11],
] as const;

export function Board({
  board,
  lastMove,
  disabled,
  previewStone = 1,
  onMove,
}: {
  board: BoardType;
  lastMove: number | null;
  disabled: boolean;
  previewStone?: 1 | 2;
  onMove: (index: number) => void;
}) {
  return (
    <div className="board-frame">
      <div className="board-surface">
        {(["top", "bottom", "left", "right"] as const).map((side) => (
          <div
            key={side}
            className={`board-coordinates coordinates-${side}`}
            aria-hidden="true"
          >
            {coordinates.map((index) => (
              <span key={index}>
                {side === "top" || side === "bottom"
                  ? String.fromCharCode(65 + index)
                  : index + 1}
              </span>
            ))}
          </div>
        ))}
        <div
          className="gomoku-board"
          role="group"
          aria-label="15 乘 15 五子棋棋盘"
        >
          {/* Each cell is 20 units; grid intersections share the button centers. */}
          <svg className="board-grid" viewBox="0 0 300 300" aria-hidden="true">
            <g className="board-grid-lines">
              {coordinates.map((index) => (
                <path
                  key={index}
                  d={`M10 ${10 + index * 20}H290 M${10 + index * 20} 10V290`}
                />
              ))}
            </g>
            <g className="board-star-points">
              {stars.map(([x, y]) => (
                <circle
                  key={`${x}-${y}`}
                  cx={10 + x * 20}
                  cy={10 + y * 20}
                  r="2.2"
                />
              ))}
            </g>
          </svg>
          {board.map((stone, index) => (
            <button
              key={index}
              className={`point ${stone ? "occupied" : "empty-point"} ${lastMove === index ? "last-move" : ""}`}
              disabled={disabled || stone !== 0}
              aria-label={`${String.fromCharCode(65 + (index % SIZE))}${Math.floor(index / SIZE) + 1}${stone ? (stone === 1 ? " 黑棋" : " 白棋") : " 空位"}${lastMove === index ? " 最后一手" : ""}`}
              onClick={() => onMove(index)}
            >
              {(stone !== 0 || !disabled) && (
                <GomokuStone stone={stone || previewStone} />
              )}
              {stone !== 0 && lastMove === index && (
                <span className="last-move-marker" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

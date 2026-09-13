import { useRef, useState } from "react";
import {
  inCheck,
  legalDestinations,
  pieceGlyph,
  sideName,
  squareName,
  type XiangqiAction,
  type XiangqiSide,
  type XiangqiState,
} from "../../shared/xiangqi.ts";
import { XiangqiPiece } from "./XiangqiPiece";
export function XiangqiBoard({
  match,
  perspective = 1,
  interactive,
  onMove,
  hint,
}: {
  match: XiangqiState;
  perspective?: XiangqiSide;
  interactive: boolean;
  onMove: (move: XiangqiAction) => void;
  hint?: XiangqiAction | null;
}) {
  const [selection, setSelection] = useState<{
    from: number;
    revision: number;
    id: string;
  } | null>(null);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const selected =
    interactive &&
    selection?.id === match.id &&
    selection.revision === match.revision
      ? selection.from
      : null;
  const destinations =
    selected === null ? [] : legalDestinations(match.board, selected);
  const checked = inCheck(match.board, match.turn);
  function click(i: number) {
    if (!interactive) return;
    if (match.board[i]?.side === match.turn)
      setSelection(
        selected === i
          ? null
          : { from: i, id: match.id, revision: match.revision },
      );
    else if (selected !== null && destinations.includes(i)) {
      setSelection(null);
      onMove({ from: selected, to: i });
    }
  }
  return (
    <div className="xq-board" role="group" aria-label="中国象棋棋盘">
      <img
        className="xq-grid"
        src="/assets/xiangqi-v1/board-grid.svg"
        alt=""
        draggable={false}
      />
      <svg className="xq-coordinates" viewBox="0 0 540 600" aria-hidden="true">
        {Array.from({ length: 9 }, (_, x) => (
          <g key={x}>
            <text x={54 + x * 54} y="27">
              {"ABCDEFGHI"[perspective === 1 ? x : 8 - x]}
            </text>
            <text x={54 + x * 54} y="584">
              {"ABCDEFGHI"[perspective === 1 ? x : 8 - x]}
            </text>
          </g>
        ))}
        {Array.from({ length: 10 }, (_, y) => (
          <g key={y}>
            <text x="24" y={62 + y * 54}>
              {perspective === 1 ? 10 - y : y + 1}
            </text>
            <text x="516" y={62 + y * 54}>
              {perspective === 1 ? 10 - y : y + 1}
            </text>
          </g>
        ))}
      </svg>
      {match.board.map((piece, i) => {
        const display = perspective === 1 ? i : 89 - i,
          x = display % 9,
          y = Math.floor(display / 9);
        const legal = destinations.includes(i),
          last = match.lastMove?.to === i,
          origin = match.lastMove?.from === i;
        const check =
          checked && piece?.kind === "king" && piece.side === match.turn;
        return (
          <button
            key={i}
            ref={(el) => {
              cells.current[i] = el;
            }}
            className={`xq-square${selected === i ? " selected" : ""}${legal ? " legal" : ""}${last ? " last-move" : ""}${origin ? " move-origin" : ""}${check ? " in-check" : ""}${hint?.from === i || hint?.to === i ? " hinted" : ""}`}
            style={{
              left: `${((54 + x * 54) / 540) * 100}%`,
              top: `${((57 + y * 54) / 600) * 100}%`,
            }}
            data-square={squareName(i)}
            disabled={!interactive}
            aria-pressed={selected === i}
            aria-label={`${squareName(i)} ${piece ? `${sideName(piece.side)}${pieceGlyph(piece)}` : "空位"}${legal ? "，可走" : ""}${check ? "，被将军" : ""}`}
            onClick={() => click(i)}
            onKeyDown={(e) => {
              const delta = (
                {
                  ArrowLeft: [-1, 0],
                  ArrowRight: [1, 0],
                  ArrowUp: [0, -1],
                  ArrowDown: [0, 1],
                } as Record<string, number[]>
              )[e.key];
              if (!delta) return;
              e.preventDefault();
              const a = x + delta[0],
                b = y + delta[1];
              if (a >= 0 && a < 9 && b >= 0 && b < 10)
                cells.current[
                  perspective === 1 ? b * 9 + a : 89 - (b * 9 + a)
                ]?.focus();
            }}
          >
            {piece && <XiangqiPiece piece={piece} />}
            {legal && (
              <span
                className={piece ? "xq-capture-target" : "xq-move-target"}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

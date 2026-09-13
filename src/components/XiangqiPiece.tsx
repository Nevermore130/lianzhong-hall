import {
  pieceGlyph,
  sideName,
  type XiangqiPiece as Piece,
} from "../../shared/xiangqi.ts";
export function XiangqiPiece({ piece }: { piece: Piece }) {
  return (
    <span
      className={`xq-piece side-${piece.side}`}
      role="img"
      aria-label={`${sideName(piece.side)}${pieceGlyph(piece)}`}
    >
      <img src="/assets/xiangqi-v1/piece-wood.webp" alt="" draggable={false} />
      <img
        src={`/assets/xiangqi-v1/pieces/${piece.side}-${piece.kind}.svg`}
        alt=""
        draggable={false}
      />
    </span>
  );
}

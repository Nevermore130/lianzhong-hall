import art from "../../public/assets/lobby-v2/manifest.json";
import { Fragment } from "react";
import { newXiangqiBoard, pieceGlyph } from "../../shared/xiangqi.ts";
const chessSetup = newXiangqiBoard();

/** Shared image files; seats only control the character layers, never fake players. */
export function TableSprite({
  occupied,
  game = "gomoku",
}: {
  occupied: [boolean, boolean];
  game?: "gomoku" | "xiangqi";
}) {
  return (
    <svg
      className="table-sprite"
      viewBox={art.viewBox.join(" ")}
      aria-hidden="true"
      focusable="false"
    >
      {art.layers.map((layer) =>
        layer.seat !== undefined && !occupied[layer.seat] ? null : (
          <Fragment key={layer.name}>
            <image
              data-layer={layer.name}
              href={`/assets/lobby-v2/${layer.file}`}
              x={layer.x}
              y={layer.y}
              width={layer.size}
              height={layer.size}
              preserveAspectRatio="xMidYMid meet"
            />
            {game === "xiangqi" && layer.name === "table" && (
              <g
                className="xq-lobby-board"
                transform="matrix(.06667 .04074 -.06167 .03667 104 52)"
              >
                <image
                  href="/assets/xiangqi-v1/board-wood.webp"
                  width="540"
                  height="600"
                />
                <image
                  href="/assets/xiangqi-v1/board-grid.svg"
                  width="540"
                  height="600"
                />
                {chessSetup.map(
                  (piece, i) =>
                    piece && (
                      <g
                        key={i}
                        transform={`translate(${54 + (i % 9) * 54} ${57 + Math.floor(i / 9) * 54})`}
                      >
                        <circle
                          r="22"
                          fill="#f3dba7"
                          stroke="#80552b"
                          strokeWidth="2"
                        />
                        <text
                          y="10"
                          textAnchor="middle"
                          fontSize="29"
                          fontFamily="serif"
                          fontWeight="bold"
                          fill={piece.side === 1 ? "#8e201b" : "#30291e"}
                        >
                          {pieceGlyph(piece)}
                        </text>
                      </g>
                    ),
                )}
              </g>
            )}
          </Fragment>
        ),
      )}
    </svg>
  );
}

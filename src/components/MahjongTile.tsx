import { tileName, tileType, type Tile } from "../../shared/mahjong.ts";
export function MahjongTile({
  tile,
  back = false,
}: {
  tile?: Tile;
  back?: boolean;
}) {
  const hidden = back || tile === undefined;
  return (
    <span
      className={`mj-tile${hidden ? " mj-tile-back" : ""}`}
      role="img"
      aria-label={hidden ? "牌背" : tileName(tile)}
    >
      {!hidden && (
        <img
          src={`/assets/mahjong-v1/glyphs/${tileType(tile)}.svg`}
          alt=""
          draggable={false}
        />
      )}
    </span>
  );
}

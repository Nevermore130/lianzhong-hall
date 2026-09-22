import type { Room, Snapshot } from "../../shared/protocol.ts";
import { TableSprite } from "./TableSprite";
import { PlayerPortrait } from "./ClientArt";
import { useTranslation } from "react-i18next";

export function LobbyScene({
  rooms,
  snapshot,
  favorites,
  toggleFavorite,
  enter,
  connected,
  available,
  gameName,
}: {
  rooms: Room[];
  snapshot: Snapshot | null;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  enter: (id: string) => void;
  connected: boolean;
  available: boolean;
  gameName: string;
}) {
  const { t } = useTranslation();
  
  return (
    <div className="lobby-scene" aria-label={t("gameLobby")}>
      {rooms.map((room) => {
        const number = room.name.match(/ (\d+) 桌$/)?.[1] ?? room.id;
        const players = room.seats.map((s) =>
          snapshot?.players.find((p) => p.id === s?.userId),
        );
        return (
          <div
            className={
              "scene-table" +
              (room.game === "doudizhu"
                ? " ddz-scene-table"
                : room.game === "mahjong"
                  ? " mj-scene-table"
                  : "")
            }
            key={room.id}
          >
            <button
              className={`table-favorite ${favorites.includes(room.id) ? "is-favorite" : ""}`}
              aria-label={`${favorites.includes(room.id) ? t("unfavoriteRoom") : t("favoriteRoom")}${room.name}`}
              onClick={() => toggleFavorite(room.id)}
            >
              {favorites.includes(room.id) ? "★" : "☆"}
            </button>
            <div className="seat-name upper">
              <span className={players[0] ? "online-gem" : "empty-gem"}>◆</span>
              {players[0]?.name ?? t("waitingToJoin")}
            </div>
            <button
              className="scene-table-enter"
              aria-label={`${t("enterRoom")}${room.name}`}
              disabled={!connected}
              onClick={() => enter(room.id)}
            >
              {room.game === "doudizhu" || room.game === "mahjong" ? (
                <>
                  <img
                    className="table-sprite"
                    src={`/assets/${room.game === "mahjong" ? "mahjong" : "doudizhu"}-v1/lobby-table.webp`}
                    alt=""
                    draggable={false}
                  />
                  {players.map((p, i) =>
                    p ? (
                      <span
                        key={i}
                        className={`${room.game === "mahjong" ? "mj" : "ddz"}-lobby-player seat-${i}`}
                      >
                        <PlayerPortrait avatar={p.avatar} />
                      </span>
                    ) : null,
                  )}
                </>
              ) : (
                <TableSprite
                  game={room.game}
                  occupied={[!!room.seats[0], !!room.seats[1]]}
                />
              )}
              <span className="table-hover-label">
                {room.match?.status === "playing" ? t("watchMatch") : t("enterRoom")}
              </span>
            </button>
            <div className="seat-name lower">
              <span className={players[1] ? "online-gem" : "empty-gem"}>◆</span>
              {players[1]?.name ?? t("waitingToJoin")}
            </div>
            {(room.game === "doudizhu" || room.game === "mahjong") && (
              <div className="seat-name third">
                <span className={players[2] ? "online-gem" : "empty-gem"}>
                  ◆
                </span>
                {players[2]?.name ?? t("waitingToJoin")}
              </div>
            )}
            {room.game === "mahjong" && (
              <div className="seat-name fourth">
                <span className={players[3] ? "online-gem" : "empty-gem"}>
                  ◆
                </span>
                {players[3]?.name ?? t("waitingToJoin")}
              </div>
            )}
            <div className="table-caption">
              <span>— {String(number).padStart(2, "0")} —</span>
              <small>
                {room.match?.status === "playing"
                  ? t("inProgress")
                  : `${room.seats.filter(Boolean).length} / ${room.seats.length}`}
              </small>
            </div>
          </div>
        );
      })}
      {!rooms.length && (
        <div className="scene-empty">
          <span>♟</span>
          <strong>
            {available ? t("noMatchingRooms") : t("gameNotAvailable", { game: gameName })}
          </strong>
          <p>
            {available
              ? t("modifySearch")
              : t("otherGamesAvailable")}
          </p>
        </div>
      )}
    </div>
  );
}

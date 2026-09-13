import type { Room, Snapshot } from "../../shared/protocol.ts";
import { TableSprite } from "./TableSprite";
import { PlayerPortrait } from "./ClientArt";
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
  return (
    <div className="lobby-scene" aria-label="游戏桌列表">
      {rooms.map((room) => {
        const number = room.name.match(/ (\d+) 桌$/)?.[1] ?? room.id;
        const players = room.seats.map((s) =>
          snapshot?.players.find((p) => p.id === s?.userId),
        );
        return (
          <div
            className={
              "scene-table" +
              (room.game === "doudizhu" ? " ddz-scene-table" : "")
            }
            key={room.id}
          >
            <button
              className={`table-favorite ${favorites.includes(room.id) ? "is-favorite" : ""}`}
              aria-label={`${favorites.includes(room.id) ? "取消收藏" : "收藏"}${room.name}`}
              onClick={() => toggleFavorite(room.id)}
            >
              {favorites.includes(room.id) ? "★" : "☆"}
            </button>
            <div className="seat-name upper">
              <span className={players[0] ? "online-gem" : "empty-gem"}>◆</span>
              {players[0]?.name ?? "等待加入"}
            </div>
            <button
              className="scene-table-enter"
              aria-label={`进入${room.name}`}
              disabled={!connected}
              onClick={() => enter(room.id)}
            >
              {room.game === "doudizhu" ? (
                <>
                  <img
                    className="table-sprite"
                    src="/assets/doudizhu-v1/lobby-table.webp"
                    alt=""
                    draggable={false}
                  />
                  {players.map((p, i) =>
                    p ? (
                      <span key={i} className={"ddz-lobby-player seat-" + i}>
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
                {room.match?.status === "playing" ? "观看对局" : "进入游戏桌"}
              </span>
            </button>
            <div className="seat-name lower">
              <span className={players[1] ? "online-gem" : "empty-gem"}>◆</span>
              {players[1]?.name ?? "等待加入"}
            </div>
            {room.game === "doudizhu" && (
              <div className="seat-name third">
                <span className={players[2] ? "online-gem" : "empty-gem"}>
                  ◆
                </span>
                {players[2]?.name ?? "等待加入"}
              </div>
            )}
            <div className="table-caption">
              <span>— {String(number).padStart(2, "0")} —</span>
              <small>
                {room.match?.status === "playing"
                  ? "对局中"
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
            {available ? "没有符合条件的游戏桌" : `${gameName}暂未开放`}
          </strong>
          <p>
            {available
              ? "请修改搜索条件，或创建新的游戏桌。"
              : "当前已开放五子棋、中国象棋与斗地主，可从右侧房间列表进入。"}
          </p>
        </div>
      )}
    </div>
  );
}

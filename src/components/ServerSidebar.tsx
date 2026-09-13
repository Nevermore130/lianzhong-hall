import { useState } from "react";
import { games, type GameId, type Snapshot } from "../../shared/protocol.ts";
import { PlayerPortrait } from "./ClientArt";
export function ServerSidebar({
  snapshot,
  selectedGame,
  enter,
  selectGame,
}: {
  snapshot: Snapshot | null;
  selectedGame: GameId | "all";
  enter: (id: string) => void;
  selectGame: (id: GameId) => void;
}) {
  const [expanded, setExpanded] = useState<GameId[]>(["gomoku"]);
  const [selectedPlayer, setSelectedPlayer] = useState(""),
    [sort, setSort] = useState<"name" | "wins">("name");
  const players = (snapshot?.players.filter((p) => p.online) ?? []).sort(
    (a, b) =>
      sort === "wins" ? b.wins - a.wins : a.name.localeCompare(b.name, "zh-CN"),
  );
  const selected = players.find((p) => p.id === selectedPlayer);
  return (
    <aside className="client-right">
      <section className="server-panel">
        <div className="pane-title">
          房间列表<span>▧</span>
        </div>
        <div className="server-tree" role="tree" aria-label="房间列表">
          <div className="server-root">
            <span className="tree-box">−</span>
            <span>🌐</span>游戏服务器
          </div>
          {games.map((g) => (
            <div className="server-game" key={g.id}>
              <div
                className={`server-game-line ${selectedGame === g.id || (selectedGame === "all" && g.id === "gomoku") ? "selected" : ""}`}
              >
                <button
                  className="tree-box"
                  aria-label={`${expanded.includes(g.id) ? "折叠" : "展开"}${g.name}`}
                  onClick={() =>
                    setExpanded((old) =>
                      old.includes(g.id)
                        ? old.filter((id) => id !== g.id)
                        : [...old, g.id],
                    )
                  }
                >
                  {expanded.includes(g.id) ? "−" : "+"}
                </button>
                <button
                  className="tree-game-select"
                  onClick={() => selectGame(g.id)}
                >
                  <span className={`game-tree-icon ${g.id}`}>{g.symbol}</span>
                  {g.name}
                  <span className="tree-count">
                    {g.available
                      ? `（${snapshot?.players.filter((p) => p.online && p.roomId).length ?? 0}人）`
                      : "（未开放）"}
                  </span>
                </button>
              </div>
              {expanded.includes(g.id) && (
                <div className="server-room-children">
                  {g.available ? (
                    snapshot?.rooms
                      .filter((r) => r.game === g.id)
                      .map((r) => (
                        <button
                          key={r.id}
                          className={snapshot.roomId === r.id ? "selected" : ""}
                          onClick={() => enter(r.id)}
                        >
                          <span className="tree-branch">└</span>
                          <span
                            className={
                              r.match?.status === "playing"
                                ? "room-bullet playing"
                                : "room-bullet"
                            }
                          >
                            ●
                          </span>
                          {r.name}
                          <small>
                            （
                            {r.seats.filter(Boolean).length + r.watchers.length}
                            人）
                          </small>
                        </button>
                      ))
                  ) : (
                    <span className="unavailable-tree">正在开发，敬请期待</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="players-panel">
        <div className="pane-title">
          玩家列表<span>{players.length} 人在线</span>
        </div>
        <div className="player-table-scroll">
          <table className="player-table">
            <thead>
              <tr>
                <th className="badge-column">身份</th>
                <th>
                  <button onClick={() => setSort("name")}>
                    用户名{sort === "name" ? " ▴" : ""}
                  </button>
                </th>
                <th>状态</th>
                <th>
                  <button onClick={() => setSort("wins")}>
                    胜局{sort === "wins" ? " ▾" : ""}
                  </button>
                </th>
                <th>负局</th>
                <th>胜率</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr
                  key={p.id}
                  className={selectedPlayer === p.id ? "selected" : ""}
                  onClick={() => setSelectedPlayer(p.id)}
                >
                  <td className="rank-cell">
                    <span className="rank-medal">{p.guest ? "◆" : "♛"}</span>
                  </td>
                  <td>
                    <button
                      className="player-name"
                      onClick={() => setSelectedPlayer(p.id)}
                    >
                      <PlayerPortrait small />
                      {p.name}
                      {p.id === snapshot?.me.id ? " [我]" : ""}
                    </button>
                  </td>
                  <td>{p.roomId ? "游戏中" : "大厅"}</td>
                  <td>{p.wins}</td>
                  <td>{p.losses}</td>
                  <td>
                    {p.wins + p.losses
                      ? `${Math.round((p.wins / (p.wins + p.losses)) * 100)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="player-details">
          {selected
            ? `${selected.name}　${selected.guest ? "游客" : "注册用户"}　${selected.roomId ? `桌号 ${Number(selected.roomId) - 1000}` : "未入座"}`
            : "点击玩家查看资料"}
        </div>
      </section>
      <section className="system-panel">
        <div className="pane-title">系统消息</div>
        <div className="system-messages" role="log" aria-label="系统消息">
          {snapshot?.messages
            .filter((m) => !m.userId)
            .map((m) => (
              <p key={m.id}>
                <b>系统：</b>
                {m.text}
              </p>
            ))}
          <p className="system-rule">五子棋采用自由规则，双方准备后开始。</p>
        </div>
      </section>
    </aside>
  );
}

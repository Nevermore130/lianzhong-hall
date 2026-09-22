import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { PlayerPortrait } from "./ClientArt";
import type { User } from "../../shared/protocol.ts";

export function Leaderboard({ close }: { close: () => void }) {
  const [leaderboard, setLeaderboard] = useState<User[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/leaderboard");
        if (!response.ok) throw new Error("加载失败");
        const data = (await response.json()) as { leaderboard: User[] };
        setLeaderboard(data.leaderboard);
      } catch {
        setError("排行榜加载失败，请稍后重试");
      }
    })();
  }, []);

  return (
    <Modal title="积分排行榜" close={close} wide>
      <div className="leaderboard">
        {!leaderboard ? (
          <p className="loading-text">
            {error || "正在加载排行榜数据…"}
          </p>
        ) : leaderboard.length === 0 ? (
          <p className="loading-text">暂无排行数据</p>
        ) : (
          <div className="leaderboard-scroll">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="rank-column">排名</th>
                  <th>棋友昵称</th>
                  <th>积分</th>
                  <th>胜局</th>
                  <th>负局</th>
                  <th>胜率</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((user, index) => (
                  <tr key={user.id} className={index < 3 ? "top-rank" : ""}>
                    <td className="rank-column">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                    </td>
                    <td className="player-cell">
                      <PlayerPortrait small avatar={user.avatar} />
                      {user.name}
                    </td>
                    <td className="points-cell">{user.points}</td>
                    <td>{user.wins}</td>
                    <td>{user.losses}</td>
                    <td>
                      {user.wins + user.losses
                        ? `${Math.round((user.wins / (user.wins + user.losses)) * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

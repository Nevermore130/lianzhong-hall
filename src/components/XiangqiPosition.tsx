import { useEffect, useId, useRef, useState } from "react";
import {
  sideName,
  type XiangqiState,
  type XiangqiSide,
  type XiangqiAction,
} from "../../shared/xiangqi.ts";
import { XiangqiBoard } from "./XiangqiBoard";
import { XiangqiPiece } from "./XiangqiPiece";
export function XiangqiPosition({
  match,
  perspective,
  interactive,
  onMove,
  hint,
}: {
  match: XiangqiState;
  perspective: XiangqiSide;
  interactive: boolean;
  onMove: (move: XiangqiAction) => void;
  hint?: XiangqiAction | null;
}) {
  const history = useRef<HTMLOListElement>(null);
  const [recordsExpanded, setRecordsExpanded] = useState(false);
  const recordId = useId();
  useEffect(() => {
    if (history.current)
      history.current.scrollTop = history.current.scrollHeight;
  }, [match.history.length, recordsExpanded]);
  return (
    <div className="xq-position">
      <XiangqiBoard
        match={match}
        perspective={perspective}
        interactive={interactive}
        onMove={onMove}
        hint={hint}
      />
      <button
        className="xq-record-toggle"
        aria-expanded={recordsExpanded}
        aria-controls={recordId}
        onClick={() => setRecordsExpanded((expanded) => !expanded)}
      >
        {recordsExpanded ? "收起棋谱与吃子" : "展开棋谱与吃子"}
        <span>
          {match.history.length} 步 {recordsExpanded ? "▴" : "▾"}
        </span>
      </button>
      <aside
        id={recordId}
        className={`xq-record-panel ${recordsExpanded ? "expanded" : ""}`}
      >
        <div className="pane-title">
          棋谱记录 <span>{match.history.length} 步</span>
        </div>
        <ol className="xq-history" aria-label="棋谱记录" ref={history}>
          {!match.history.length && (
            <li className="xq-history-empty">
              红方先行
              <br />
              点击棋子查看可走位置
            </li>
          )}
          {match.history.map((m, i) => (
            <li key={i} className={`side-${m.piece.side}`}>
              <span>{i + 1}.</span>
              {m.label}
            </li>
          ))}
        </ol>
        {([1, 2] as const).map((side) => (
          <div className="xq-captures" key={side}>
            <strong>{sideName(side)}吃子</strong>
            <div>
              {match.history
                .filter((m) => m.piece.side === side && m.captured)
                .map((m, i) => (
                  <XiangqiPiece key={i} piece={m.captured!} />
                ))}
              {!match.history.some(
                (m) => m.piece.side === side && m.captured,
              ) && <small>暂无</small>}
            </div>
          </div>
        ))}
        <p className="xq-legend">
          绿点可走 · 圈内可吃
          <br />
          金框为上一步 · 红框为将军
        </p>
      </aside>
    </div>
  );
}

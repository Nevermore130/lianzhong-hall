import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { ToolbarIcon } from "../../../src/components/ClientArt";
import { LobbyScene } from "../../../src/components/LobbyScene";
import { RoomView } from "../../../src/components/RoomView";
import { ServerSidebar } from "../../../src/components/ServerSidebar";
import { DoudizhuTable } from "../.generated/DoudizhuTable";
import { MahjongTable } from "../.generated/MahjongTable";
import { XiangqiBoard } from "../.generated/XiangqiBoard";
import { games } from "../../../shared/protocol";
import { doudizhuView } from "../../../shared/doudizhu";
import { mahjongView } from "../../../shared/mahjong";
import {
  atTime,
  captions,
  cues,
  discardedTile,
  doudizhu,
  FPS,
  gomokuRoom,
  mahjong,
  practicePlayers,
  rooms,
  screen,
  selectedCards,
  snapshot,
  xiangqi,
  type Cue,
} from "./story";
import appCSS from "../.generated/app-css";
import assets from "../.generated/assets";
import "./video.css";

const noop = () => {},
  accepted = () => true;
const tools = [
  ["home", "游戏大厅"],
  ["account", "注册账号"],
  ["practice", "单机游戏"],
  ["star", "我的收藏"],
  ["settings", "游戏设置"],
  ["help", "游戏帮助"],
  ["exit", "收起大厅"],
] as const;
const ease = (x: number) => {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

function FilmModal({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="film-backdrop" />
      <div
        className="retro-dialog wide film-dialog"
        role="dialog"
        aria-label={title}
      >
        <div className="window-title">
          <span>▣ &nbsp; {title}</span>
          <button aria-label="关闭弹窗">×</button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </>
  );
}
function Client({ t }: { t: number }) {
  const route = screen(t),
    inRoom = route.mode === "gomoku";
  const room = inRoom ? gomokuRoom(t) : null,
    state = snapshot(room);
  const filtered = rooms.filter(
    (r) => route.game === "all" || r.game === route.game,
  );
  const xq = atTime(xiangqi, t);
  const selection =
    t >= 12.42 && t < 13.1 ? 70 : t >= 14.92 && t < 15.65 ? 82 : null;
  return (
    <>
      <div className="game-client">
        <header className="client-header">
          <div className="client-caption">
            <span>
              <ToolbarIcon kind="home" />
              联众游戏大厅 <small>游戏客户端 · 开发版</small>
            </span>
            <div className="caption-controls">
              <button>−</button>
              <button>□</button>
              <button>?</button>
            </div>
          </div>
          <div className="main-toolbar">
            <button className="identity-capsule">
              <ToolbarIcon kind="account" />
              <span>
                <b>体验玩家</b>
                <small>
                  <i className="online-indicator" />
                  游客
                </small>
              </span>
            </button>
            <nav aria-label="主工具栏">
              {tools.map(([kind, label]) => (
                <button key={kind} data-tool={kind}>
                  <ToolbarIcon kind={kind} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="header-account">交互演示</div>
          </div>
        </header>
        <div className="client-tabbar">
          <span className="announcement">
            ◆ 五子棋、中国象棋、斗地主与中国麻将
          </span>
          <div className="game-tabs" role="tablist">
            {games.map((g) => (
              <button
                key={g.id}
                className={route.game === g.id ? "active" : ""}
              >
                <span className={"tab-symbol " + g.id}>{g.symbol}</span>
                {g.name}
              </button>
            ))}
          </div>
          <button className="mobile-directory">房间 / 玩家</button>
        </div>
        <div className="client-layout">
          <div className="client-left">
            <section className="table-pane">
              <div className="hall-menubar">
                <span>
                  {games.find((g) => g.id === route.game)?.name ?? "全部游戏"} /{" "}
                  {inRoom ? "五子棋 01 桌" : "休闲大厅"}
                </span>
                <div>
                  <button>快速进桌</button>
                  <button>创建房间</button>
                </div>
              </div>
              {inRoom ? (
                <div className="live-room-scroll">
                  <RoomView
                    room={room!}
                    snapshot={state}
                    send={accepted}
                    connected
                  />
                </div>
              ) : (
                <>
                  <div className="hall-filterbar">
                    <label className="hall-search">
                      ⌕ <input placeholder="房间名 / 编号" readOnly />
                    </label>
                    <label>
                      <input type="checkbox" readOnly />
                      隐藏满桌
                    </label>
                    <span>{filtered.length} 张游戏桌</span>
                  </div>
                  <LobbyScene
                    rooms={filtered}
                    snapshot={state}
                    favorites={[]}
                    toggleFavorite={noop}
                    enter={noop}
                    connected
                    available
                    gameName="游戏大厅"
                  />
                </>
              )}
            </section>
            <section
              className="client-chat enhanced-chat"
              aria-label="聊天面板"
            >
              <div className="chat-tabs">
                <button role="tab" aria-selected={!inRoom}>
                  大厅聊天
                </button>
                <button role="tab" aria-selected={inRoom}>
                  房间聊天
                </button>
                <small>已连接</small>
                <button className="chat-emoticon">☺</button>
              </div>
              <div className="chat-messages">
                <p style={{ color: "#69727a", fontSize: 11, padding: 8 }}>
                  欢迎来到游戏大厅，选择一张棋桌开始吧。
                </p>
              </div>
              <div className="chat-form">
                <label>对大厅说：</label>
                <input id="chat-composer" placeholder="输入消息…" readOnly />
                <button disabled>发送</button>
              </div>
            </section>
          </div>
          <ServerSidebar
            snapshot={state}
            selectedGame={route.game}
            enter={noop}
            selectGame={noop}
          />
        </div>
        <footer className="client-status">
          <span>
            <i className="online-indicator" /> 连接正常　游戏桌：24
          </span>
          <span>
            <time>交互演示</time>
          </span>
        </footer>
      </div>
      {route.mode === "xiangqi" && (
        <FilmModal title="中国象棋 · 单机练习">
          <div className="practice-title">
            <div>
              <h2>中国象棋人机对局</h2>
              <p>你执红 · 红先黑后 · 不计战绩</p>
            </div>
            <span className="pill">单机</span>
          </div>
          <div className="xq-practice-options">
            <label>
              执方（新局）
              <select value="red" onChange={noop}>
                <option value="red">红方先行</option>
              </select>
            </label>
            <label>
              电脑难度
              <select value="normal" onChange={noop}>
                <option value="normal">普通</option>
              </select>
            </label>
          </div>
          <div className="match-notice your-turn">
            {xq.turn === 1
              ? "轮到你了 · 先选棋子，再点可走位置"
              : "电脑正在思考…"}
          </div>
          <div className="xq-position">
            <XiangqiBoard
              match={xq}
              perspective={1}
              interactive={xq.turn === 1}
              onMove={noop}
              replaySelected={selection}
            />
            <button className="xq-record-toggle">
              展开棋谱与吃子 <span>{xq.history.length} 步 ▾</span>
            </button>
          </div>
          <div className="xq-hint">绿点可走 · 圈内可吃</div>
          <div className="dialog-actions">
            <button>提示走法</button>
            <button>悔棋一回合</button>
            <button>重新开局</button>
            <button>返回大厅</button>
          </div>
        </FilmModal>
      )}
      {route.mode === "doudizhu" && (
        <FilmModal title="斗地主 · 单机练习">
          <div className="ddz-practice-header">
            <b>经典斗地主</b>
            <span>两位电脑陪练 · 不计战绩</span>
          </div>
          <DoudizhuTable
            match={doudizhuView(atTime(doudizhu, t), 0)}
            players={practicePlayers.slice(0, 3)}
            ownSeat={0}
            connected
            onAction={accepted}
            replaySelected={t >= 19.75 && t < 21.6 ? selectedCards : []}
          />
          <div className="dialog-actions">
            <button>重新发牌</button>
            <button>返回大厅</button>
          </div>
        </FilmModal>
      )}
      {route.mode === "mahjong" && (
        <FilmModal title="中国麻将 · 单机练习">
          <div className="mj-practice-header">
            <b>中国麻将</b>
            <span>三位电脑陪练 · 不计战绩</span>
          </div>
          <MahjongTable
            match={mahjongView(atTime(mahjong, t), 0)}
            players={practicePlayers}
            ownSeat={0}
            connected
            onAction={accepted}
            replaySelected={t >= 28.4 && t < 29.1 ? discardedTile : null}
          />
          <div className="dialog-actions">
            <button>重新发牌</button>
            <button>返回大厅</button>
          </div>
        </FilmModal>
      )}
    </>
  );
}

export function InteractionFilm() {
  const frame = useCurrentFrame(),
    t = frame / FPS,
    route = screen(t);
  const scale = 2.4;
  const world = useRef<HTMLDivElement>(null);
  const [assetsHandle] = useState(() =>
    delayRender("Load original local game assets"),
  );
  const [layoutHandle] = useState(() =>
    delayRender("Measure interaction targets"),
  );
  const [assetsReady, setAssetsReady] = useState(false);
  const [pointer, setPointer] = useState<[number, number]>([350, 530]);
  const [highlight, setHighlight] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [actionCss, setActionCss] = useState("");
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      document.fonts.ready,
      ...assets.map(
        (src) =>
          new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Asset failed: " + src));
            img.src = staticFile(src.slice(1));
          }),
      ),
    ])
      .then(() => {
        if (!cancelled) setAssetsReady(true);
      })
      .catch((error) => {
        throw error;
      });
    return () => {
      cancelled = true;
    };
  }, [assetsHandle]);
  useLayoutEffect(() => {
    if (!assetsReady) return;
    const root = world.current!;
    const hand = root.querySelector(".ddz-hand-scroll");
    if (hand) {
      const p =
        t < 20.1
          ? 0
          : t < 20.9
            ? ease((t - 20.1) / 0.8)
            : t < 21.6
              ? 1
              : ease(1 - (t - 21.6) / 0.4);
      hand.scrollLeft = p * (hand.scrollWidth - hand.clientWidth);
    }
    const mjhand = root.querySelector(".mj-hand-scroll");
    if (mjhand) {
      mjhand.scrollLeft =
        t >= 28.1 && t < 29.1
          ? (mjhand.scrollWidth - mjhand.clientWidth) * ease((t - 28.1) / 0.18)
          : 0;
    }
    const bounds = root.getBoundingClientRect();
    const measure = (cue: Cue): [number, number] => {
      const el = cue.selector ? root.querySelector(cue.selector) : null;
      if (!el) return cue.fallback;
      const r = el.getBoundingClientRect();
      return [
        (r.left + r.width / 2 - bounds.left) / scale,
        (r.top + r.height / 2 - bounds.top) / scale,
      ];
    };
    const idx = Math.max(
      0,
      cues.findLastIndex((c) => c.at <= t),
    );
    const a = cues[idx],
      b = cues[Math.min(idx + 1, cues.length - 1)];
    const progress = ease(
      (t - Math.max(a.at + 0.12, b.at - 0.55)) /
        (b.at - Math.max(a.at + 0.12, b.at - 0.55) || 1),
    );
    const pa = measure(a),
      pb = measure(b);
    setPointer([lerp(pa[0], pb[0], progress), lerp(pa[1], pb[1], progress)]);
    const click = cues.find((c) => c.click && t >= c.at && t < c.at + 0.18);
    setActionCss(
      click?.selector ? `${click.selector}{filter:brightness(.83);}` : "",
    );
    const upcoming = cues.find((c) => c.click && c.at > t && c.at < t + 0.36);
    const el = upcoming?.selector
      ? root.querySelector(upcoming.selector)
      : null;
    if (el && ["INPUT", "BUTTON"].includes(el.tagName)) {
      const r = el.getBoundingClientRect();
      setHighlight({
        x: (r.x - bounds.x) / scale,
        y: (r.y - bounds.y) / scale,
        width: r.width / scale,
        height: r.height / scale,
      });
    } else setHighlight(null);
    continueRender(layoutHandle);
    continueRender(assetsHandle);
  }, [frame, layoutHandle, assetsHandle, assetsReady, route.mode, t, scale]);
  const click = cues.find((c) => c.click && t >= c.at && t < c.at + 0.35);
  const clickProgress = click ? (t - click.at) / 0.35 : 1;
  const caption = captions.find((c) => t >= c.from && t < c.to)!;
  const captionOpacity = interpolate(
    t,
    [caption.from, caption.from + 0.15, caption.to - 0.1, caption.to],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill
      style={{
        background: "#c0c0c0",
        fontFamily: 'Tahoma, "Songti SC", serif',
      }}
    >
      <style>
        {appCSS
          .replaceAll("/assets/", staticFile("assets/"))
          .replaceAll("/textures/", staticFile("textures/"))}
      </style>
      <style>{actionCss}</style>
      <div
        className="film-world"
        ref={world}
        style={{ transform: `scale(${scale})` }}
      >
        <Client t={t} />
        {highlight && (
          <div
            className="film-target"
            style={{
              left: highlight.x,
              top: highlight.y,
              width: highlight.width,
              height: highlight.height,
            }}
          />
        )}
        {click && (
          <div
            className="film-click"
            style={{
              left: pointer[0] - 20,
              top: pointer[1] - 20,
              transform: `scale(${0.3 + clickProgress * 1.8})`,
              opacity: 1 - clickProgress,
            }}
          />
        )}
        <svg
          className="film-pointer"
          viewBox="0 0 34 46"
          style={{
            left: pointer[0],
            top: pointer[1],
            transform: `scale(${click && clickProgress < 0.3 ? 0.85 : 1})`,
          }}
        >
          <path
            d="M2 2v33l8-8 7 16 7-3-7-15h13Z"
            fill="#fff"
            stroke="#151919"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="film-subtitle" style={{ opacity: captionOpacity }}>
        {caption.text}
      </div>
      <Audio src={staticFile("promo-audio/interaction.wav")} volume={1} />
    </AbsoluteFill>
  );
}

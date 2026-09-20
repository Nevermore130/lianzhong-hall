import { MahjongRoomView } from "./components/MahjongRoomView";
import { MahjongPractice } from "./components/MahjongPractice";
import { MahjongRules } from "./components/MahjongRules";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Maximize2,
  Minus,
  Monitor,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { games, type GameId, type User } from "../shared/protocol.ts";
import { api, useHall } from "./lib/client";
import { useIdentity } from "./lib/identity";
import { AuthDialog, type AuthMode } from "./components/AuthDialog";
import { AccountCenter } from "./components/AccountCenter";
import { ToolbarIcon } from "./components/ClientArt";
import { LobbyScene } from "./components/LobbyScene";
import { ServerSidebar } from "./components/ServerSidebar";
import { Modal } from "./components/Modal";
import { Practice } from "./components/Practice";
import { RoomView } from "./components/RoomView";
import { DoudizhuRoomView } from "./components/DoudizhuRoomView";
import { DoudizhuPractice } from "./components/DoudizhuPractice";
import { XiangqiRoomView } from "./components/XiangqiRoomView";
import { XiangqiPractice } from "./components/XiangqiPractice";
import { ChatPanel } from "./components/ChatPanel";
import { useVisualViewport } from "./lib/useVisualViewport";
import {
  SoundManager,
  loadSoundSetting,
  saveSoundSetting,
} from "./lib/sound";
import {
  BGMManager,
  loadMusicSetting,
  saveMusicSetting,
} from "./lib/bgm";

type Dialog =
  AuthMode | "account" | "create" | "help" | "about" | "practice" | null;
export default function App() {
  useVisualViewport();
  const [showSidebar, setShowSidebar] = useState(false);
  const { user, bootError, revision, accept, reconcile } = useIdentity();
  const [recovery] = useState(() => {
    const match = /^#(verify-email|reset-password)=([a-f0-9]{64})$/.exec(
      location.hash,
    );
    return match
      ? {
          mode:
            match[1] === "verify-email"
              ? ("verify" as const)
              : ("reset" as const),
          token: match[2],
        }
      : null;
  });
  const [dialog, setDialog] = useState<Dialog>(recovery?.mode ?? null),
    [game, setGame] = useState<GameId | "all">("all");
  const [search, setSearch] = useState(""),
    [hideFull, setHideFull] = useState(false),
    [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem("hall:favorites") ?? "[]");
      return Array.isArray(value)
        ? value.filter((x) => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [sound, setSound] = useState(loadSoundSetting),
    [music, setMusic] = useState(loadMusicSetting),
    [minimized, setMinimized] = useState(false);
  const [now, setNow] = useState(new Date()),
    [busy, setBusy] = useState(false);
  const { snapshot, status, error, setError, send, subscribe } = useHall(
    user,
    () => {
      void reconcile();
    },
    revision,
  );
  const inviteJoined = useRef(false),
    soundManager = useRef(new SoundManager(loadSoundSetting())),
    bgmManager = useRef(new BGMManager(loadMusicSetting()));
  const room = snapshot?.rooms.find((r) => r.id === snapshot.roomId),
    me = snapshot?.me ?? user;
  const moveRevision =
    room?.game === "gomoku" ? room.match?.lastMove : room?.match?.revision;
  const activeMatch =
    room?.match?.status === "playing" &&
    room.seats.some((s) => s?.userId === me?.id);
  const online = snapshot?.players.filter((p) => p.online) ?? [];
  const connected = status === "connected";
  useEffect(() => {
    if (recovery)
      history.replaceState(null, "", location.pathname + location.search);
  }, [recovery]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (connected && snapshot && !inviteJoined.current) {
      inviteJoined.current = true;
      const id = new URLSearchParams(location.search).get("room");
      if (id) send({ type: "join", roomId: id });
    }
  }, [connected, snapshot, send]);
  useEffect(() => {
    try {
      localStorage.setItem("hall:favorites", JSON.stringify(favorites));
    } catch {
      /* Optional preference storage. */
    }
  }, [favorites]);
  useEffect(() => {
    soundManager.current.setEnabled(sound);
  }, [sound]);
  useEffect(() => {
    bgmManager.current.setEnabled(music);
  }, [music]);
  useEffect(() => {
    if (sound && moveRevision !== null && moveRevision !== undefined)
      soundManager.current.play("place");
  }, [room?.match?.id, moveRevision, sound]);
  function toggleSound() {
    const next = !sound;
    setSound(next);
    saveSoundSetting(next);
    soundManager.current.setEnabled(next);
    if (next) {
      soundManager.current.unlock();
      soundManager.current.play("place");
    }
  }
  function toggleMusic() {
    const next = !music;
    setMusic(next);
    saveMusicSetting(next);
    bgmManager.current.setEnabled(next);
    if (next) {
      bgmManager.current.unlock();
    }
  }
  function open(value: Dialog) {
    setDialog(value);
  }
  function selectGame(id: GameId | "all") {
    if (activeMatch) {
      setError("请先完成对局，或认输后切换游戏");
      return;
    }
    setShowSidebar(false);
    setGame(id);
    setOnlyFavorites(false);
    if (room && !activeMatch) send({ type: "leave" });
  }
  async function logout() {
    setBusy(true);
    try {
      await api("logout", {});
      accept(null);
      const result = await api<{ user: User }>("guest", {});
      accept(result.user);
      setDialog(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filteredRooms =
    snapshot?.rooms.filter(
      (r) =>
        (game === "all" || r.game === game) &&
        (!onlyFavorites || favorites.includes(r.id)) &&
        (!hideFull || r.seats.some((s) => !s)) &&
        `${r.name}${r.id}`.includes(search.trim()),
    ) ?? [];
  const selectedGame = room?.game ?? game;
  const currentGame = games.find((g) => g.id === selectedGame),
    time = now.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return (
    <div className={`game-client ${minimized ? "client-minimized" : ""}`}>
      <header className="client-header">
        <div className="client-caption">
          <span>
            <ToolbarIcon kind="home" />
            众乐游戏大厅
          </span>
          <div className="caption-controls">
            <button
              aria-label={minimized ? "恢复窗口" : "最小化窗口"}
              onClick={() => setMinimized((v) => !v)}
            >
              <Minus size={12} />
            </button>
            <button
              aria-label="切换全屏"
              onClick={() => {
                const action = document.fullscreenElement
                  ? document.exitFullscreen()
                  : document.documentElement.requestFullscreen();
                void action.catch(() => setError("当前窗口不支持全屏显示"));
              }}
            >
              <Maximize2 size={10} />
            </button>
            <button aria-label="游戏帮助" onClick={() => open("help")}>
              <CircleHelp size={11} />
            </button>
          </div>
        </div>
        <div className="main-toolbar">
          <button
            className="identity-capsule"
            disabled={!!activeMatch}
            onClick={() => open(me?.guest ? "login" : "account")}
          >
            <ToolbarIcon kind="account" />
            <span>
              <b>{me?.name ?? "连接中…"}</b>
              <small>
                <i
                  className={
                    connected ? "online-indicator" : "offline-indicator"
                  }
                />
                {me?.guest ? "游客" : "注册玩家"}
              </small>
            </span>
          </button>
          <nav aria-label="主工具栏">
            <button onClick={() => selectGame("all")}>
              <ToolbarIcon kind="home" />
              <span>游戏大厅</span>
            </button>
            <button
              disabled={!!activeMatch}
              onClick={() => open(me?.guest ? "register" : "account")}
            >
              <ToolbarIcon kind="account" />
              <span>{me?.guest ? "注册账号" : "我的账号"}</span>
            </button>
            <button onClick={() => open("practice")}>
              <ToolbarIcon kind="practice" />
              <span>单机游戏</span>
            </button>
            <button
              className={onlyFavorites ? "pressed" : ""}
              disabled={!!activeMatch}
              onClick={() => {
                if (room) send({ type: "leave" });
                setOnlyFavorites((v) => !v);
              }}
            >
              <ToolbarIcon kind="star" />
              <span>我的收藏</span>
            </button>
            <button onClick={() => open("about")}>
              <ToolbarIcon kind="settings" />
              <span>游戏设置</span>
            </button>
            <button onClick={() => open("help")}>
              <ToolbarIcon kind="help" />
              <span>游戏帮助</span>
            </button>
            <button
              disabled={!!activeMatch || busy}
              onClick={() => {
                if (me?.guest) setMinimized(true);
                else void logout();
              }}
            >
              <ToolbarIcon kind="exit" />
              <span>{me?.guest ? "收起大厅" : "退出账号"}</span>
            </button>
          </nav>
          <div className="header-account">
            <span>在线：{online.length} 人</span>
            <button disabled={!!activeMatch} onClick={() => open("login")}>
              切换账号
            </button>
          </div>
        </div>
      </header>
      {minimized ? (
        <div className="restore-window">
          <Monitor size={25} />
          <span>游戏大厅已收起</span>
          <button onClick={() => setMinimized(false)}>恢复窗口</button>
        </div>
      ) : (
        <>
          <div className="client-tabbar">
            <span className="announcement">
              ◆ 已开放五子棋、中国象棋、斗地主与中国麻将，入座并准备后开始游戏。
            </span>
            <div className="game-tabs" role="tablist" aria-label="游戏切换">
              {games.map((g) => (
                <button
                  role="tab"
                  aria-selected={selectedGame === g.id}
                  key={g.id}
                  className={selectedGame === g.id ? "active" : ""}
                  onClick={() => selectGame(g.id)}
                >
                  <span className={`tab-symbol ${g.id}`}>{g.symbol}</span>
                  {g.name}
                </button>
              ))}
            </div>
            <button
              className="mobile-directory"
              aria-expanded={showSidebar}
              onClick={() => setShowSidebar((v) => !v)}
            >
              {showSidebar ? "返回棋桌" : "房间 / 玩家"}
            </button>
          </div>
          {bootError && (
            <div className="connection-banner" role="alert">
              {bootError}
              <button onClick={() => open("login")}>重新登录</button>
              <button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void api<{ user: User }>("guest", {})
                    .then(({ user }) => accept(user))
                    .catch((error: Error) => setError(error.message))
                    .finally(() => setBusy(false));
                }}
              >
                游客进入
              </button>
            </div>
          )}
          {!connected && user && (
            <div className="connection-banner" role="status">
              连接恢复中，断线后座位保留 30 秒。
            </div>
          )}
          <div
            className={`client-layout ${showSidebar ? "show-directory" : ""}`}
          >
            <div className="client-left">
              <section className="table-pane">
                <div className="hall-menubar">
                  <span>
                    <b>{currentGame?.name ?? "全部游戏"}</b> /{" "}
                    {room
                      ? room.name
                      : onlyFavorites
                        ? "收藏的游戏桌"
                        : "休闲大厅"}
                  </span>
                  <div>
                    <button
                      disabled={
                        !connected ||
                        !!activeMatch ||
                        !!(currentGame && !currentGame.available)
                      }
                      onClick={() => {
                        const next = filteredRooms.find((r) =>
                          r.seats.some((s) => !s),
                        );
                        if (next) send({ type: "join", roomId: next.id });
                      }}
                    >
                      快速进桌
                    </button>
                    <button
                      disabled={
                        !connected ||
                        !!activeMatch ||
                        !!(currentGame && !currentGame.available)
                      }
                      onClick={() => open("create")}
                    >
                      创建房间
                    </button>
                    <button onClick={() => open("help")}>游戏规则</button>
                  </div>
                </div>
                {!room && (
                  <div className="hall-filterbar">
                    <label className="hall-search">
                      <Search size={11} />
                      <input
                        aria-label="搜索房间"
                        placeholder="房间名 / 编号"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {search && (
                        <button
                          aria-label="清空搜索"
                          onClick={() => setSearch("")}
                        >
                          <X size={10} />
                        </button>
                      )}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={hideFull}
                        onChange={(e) => setHideFull(e.target.checked)}
                      />
                      隐藏满桌
                    </label>
                    <span>{filteredRooms.length} 张游戏桌</span>
                    <button
                      className="sound-toggle"
                      aria-label={music ? "关闭音乐" : "开启音乐"}
                      onClick={toggleMusic}
                      title={music ? "背景音乐已开启" : "背景音乐已关闭"}
                    >
                      🎵
                    </button>
                    <button
                      className="sound-toggle"
                      aria-label={sound ? "关闭音效" : "开启音效"}
                      onClick={toggleSound}
                    >
                      {sound ? <Volume2 size={12} /> : <VolumeX size={12} />}
                    </button>
                  </div>
                )}
                {room && snapshot ? (
                  <div className="live-room-scroll">
                    {room.game === "mahjong" ? (
                      <MahjongRoomView
                        key={room.id}
                        room={room}
                        snapshot={snapshot}
                        send={send}
                        connected={connected}
                        soundManager={soundManager.current}
                        bgmManager={bgmManager.current}
                      />
                    ) : room.game === "doudizhu" ? (
                      <DoudizhuRoomView
                        room={room}
                        snapshot={snapshot}
                        send={send}
                        connected={connected}
                        soundManager={soundManager.current}
                        bgmManager={bgmManager.current}
                        key={room.id}
                      />
                    ) : room.game === "xiangqi" ? (
                      <XiangqiRoomView
                        key={room.id}
                        room={room}
                        snapshot={snapshot}
                        send={send}
                        connected={connected}
                        soundManager={soundManager.current}
                        bgmManager={bgmManager.current}
                      />
                    ) : (
                      <RoomView
                        key={room.id}
                        room={room}
                        snapshot={snapshot}
                        send={send}
                        connected={connected}
                        soundManager={soundManager.current}
                        bgmManager={bgmManager.current}
                      />
                    )}
                  </div>
                ) : (
                  <LobbyScene
                    rooms={filteredRooms}
                    snapshot={snapshot}
                    favorites={favorites}
                    connected={connected}
                    available={!currentGame || currentGame.available}
                    gameName={currentGame?.name ?? "五子棋"}
                    toggleFavorite={(id) =>
                      setFavorites((old) =>
                        old.includes(id)
                          ? old.filter((x) => x !== id)
                          : [...old, id],
                      )
                    }
                    enter={(id) => send({ type: "join", roomId: id })}
                  />
                )}
              </section>
              {me ? (
                <ChatPanel
                  key={me.id}
                  user={me}
                  snapshot={snapshot?.chat ?? null}
                  connected={connected}
                  reading={!dialog && !showSidebar}
                  send={send}
                  subscribe={subscribe}
                />
              ) : (
                <section className="client-chat">
                  <p className="chat-empty">登录或以游客身份进入后即可聊天。</p>
                </section>
              )}
            </div>
            <ServerSidebar
              snapshot={snapshot}
              selectedGame={selectedGame}
              selectGame={selectGame}
              enter={(id) => {
                send({ type: "join", roomId: id });
                setShowSidebar(false);
              }}
            />
          </div>
          <footer className="client-status">
            <span>
              <i
                className={connected ? "online-indicator" : "offline-indicator"}
              />
              {connected ? "连接正常" : "连接中"}　在线人数：{online.length}
              　游戏桌：{snapshot?.rooms.length ?? 0}
            </span>
            <span>
              {currentGame?.id === "mahjong"
                ? "中国麻将 · 大众简化规则"
                : currentGame?.id === "doudizhu"
                  ? "斗地主 · 经典叫分"
                  : currentGame?.id === "xiangqi"
                    ? "中国象棋 · 娱乐规则"
                    : "五子棋 · 自由规则"}{" "}
              <time>{time}</time>
            </span>
          </footer>
        </>
      )}
      {error && (
        <div className="toast" role="alert">
          <CircleHelp size={16} />
          {error}
          <button onClick={() => setError("")}>关闭</button>
        </div>
      )}
      {dialog === "practice" &&
        (currentGame?.id === "mahjong" ? (
          <MahjongPractice
            close={() => setDialog(null)}
            soundManager={soundManager.current}
            bgmManager={bgmManager.current}
          />
        ) : currentGame?.id === "doudizhu" ? (
          <DoudizhuPractice
            close={() => setDialog(null)}
            soundManager={soundManager.current}
            bgmManager={bgmManager.current}
          />
        ) : currentGame?.id === "xiangqi" ? (
          <XiangqiPractice
            close={() => setDialog(null)}
            soundManager={soundManager.current}
            bgmManager={bgmManager.current}
          />
        ) : (
          <Practice
            close={() => setDialog(null)}
            soundManager={soundManager.current}
            bgmManager={bgmManager.current}
          />
        ))}
      {dialog &&
        ["login", "register", "forgot", "reset", "verify"].includes(dialog) && (
          <AuthDialog
            key={dialog}
            mode={dialog as AuthMode}
            token={recovery?.token}
            user={me}
            close={() => setDialog(null)}
            switchMode={open}
            accepted={(next) => {
              accept(next);
              setDialog(null);
            }}
            verified={() => {
              void reconcile(true);
            }}
          />
        )}
      {dialog === "account" && me && !me.guest && (
        <AccountCenter
          user={me}
          close={() => setDialog(null)}
          accepted={accept}
          deleted={() => {
            accept(null);
            setDialog("login");
          }}
        />
      )}
      {dialog === "create" && (
        <Modal title="创建游戏房间" close={() => setDialog(null)}>
          <h2>创建游戏桌</h2>
          <p>创建后可复制邀请链接，好友进入后即可入座。</p>
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              const name = new FormData(event.currentTarget).get(
                "roomName",
              ) as string;
              const value = new FormData(event.currentTarget).get("game");
              const game =
                value === "doudizhu" ||
                value === "xiangqi" ||
                value === "mahjong"
                  ? value
                  : "gomoku";
              if (send({ type: "create", name, game })) setDialog(null);
            }}
          >
            <label>
              房间名称
              <input
                name="roomName"
                placeholder="输入房间名称"
                required
                minLength={2}
                maxLength={16}
              />
            </label>
            <label>
              游戏
              <select
                name="game"
                defaultValue={
                  currentGame?.available ? currentGame.id : "gomoku"
                }
              >
                <option value="gomoku">五子棋 · 双人自由规则</option>
                <option value="xiangqi">中国象棋 · 双人对弈</option>
                <option value="mahjong">中国麻将 · 四人大众规则</option>
                <option value="doudizhu">斗地主 · 三人经典叫分</option>
              </select>
            </label>
            <button type="submit" className="primary" disabled={!connected}>
              <Plus size={15} />
              创建房间
            </button>
          </form>
        </Modal>
      )}
      {dialog === "help" && (
        <Modal title="游戏帮助" close={() => setDialog(null)}>
          <h2>游戏操作说明</h2>
          {currentGame?.id === "mahjong" ? (
            <MahjongRules />
          ) : currentGame?.id === "doudizhu" ? (
            <ul className="ddz-rule-list">
              <li>
                三人入座并准备，54 张牌，每人 17 张、底牌 3 张；叫分时底牌隐藏。
              </li>
              <li>
                轮流叫 1–3 分或不叫，必须高于前人；叫 3
                分立即成为地主。都不叫则重新发牌。
              </li>
              <li>
                地主先出，按座位顺序轮流接牌；两人不出后由最后出牌者重新领出。先出完者所属一方获胜。
              </li>
              <li>
                支持单张、对子、三张、三带一/一对、顺子（至少 5 张）、连对（至少
                3 对）、飞机及单/对翅膀、四带二/两对、炸弹和王炸。
              </li>
              <li>
                顺子、连对和飞机主体不含 2
                与王。单翅可以成对，不带双王，不带主体点数；对翅必须为不同对子。四带二可带一对，不带双王。
              </li>
              <li>
                同牌型、同张数比较主体大小；炸弹压普通牌，王炸最大。炸弹、王炸、春天/反春翻倍，地主得失两份分，农民各一份。
              </li>
              <li>
                点击手牌选中，支持提示、重选和不出；领出时必须出牌。娱乐计分，无充值与现金结算。
              </li>
            </ul>
          ) : currentGame?.id === "xiangqi" ? (
            <ul className="ddz-rule-list">
              <li>
                两人入座并准备，红方先行。点击自己的棋子，再点击绿点走棋，绿圈表示可吃子。
              </li>
              <li>
                車走直线；馬走日且不能蹩腿；相／象走田、不能塞眼和过河；仕／士与帥／將不能离开九宫；炮须隔一个棋子吃子；兵／卒过河后可横走，不能后退。
              </li>
              <li>
                走棋后不能使己方帥／將受攻击，也不能将帅照面。将死或困毙（无合法走法）均判负。
              </li>
              <li>
                可求和、认输、翻转棋盘；联机不开放悔棋。练习提供红黑执方、电脑难度、提示与悔棋，不计战绩。
              </li>
              <li>
                本版娱乐规则：同一局面出现三次，单方持续长将判该方负，其余重复局面判和；连续
                120 步未吃子判和。复杂长捉、棋例裁定和比赛计时暂未实现。
              </li>
            </ul>
          ) : (
            <>
              <ol className="help-steps">
                <li>
                  <strong>进入房间</strong>
                  <p>点击大厅里的棋桌，或创建自己的房间。</p>
                </li>
                <li>
                  <strong>选择席位并准备</strong>
                  <p>
                    选择黑棋或白棋的座位，复制邀请链接给朋友。双方点击“准备开始”就会开局。
                  </p>
                </li>
                <li>
                  <strong>胜负规则</strong>
                  <p>
                    黑棋先行，轮流落子。横、竖、斜任意方向连续五子或更多获胜，本版不设禁手。
                  </p>
                </li>
              </ol>
            </>
          )}
          <div className="help-note">
            <ShieldCheck size={19} />
            <p>
              刷新可恢复座位与本人手牌。断线暂停操作，30
              秒未返回则所在方判负；斗地主叫分阶段退出取消本局，不计战绩。麻将中途退出会中止本局，仅退出者记负。
            </p>
          </div>
          <p className="muted">
            同一浏览器的多个标签页共享账号。多人对局需要独立浏览器、配置文件或设备。选择五子棋、象棋、斗地主或麻将后点击「单机游戏」即可练习。
          </p>
          <button
            className="primary full-width"
            onClick={() => open("practice")}
          >
            先和电脑练习一局
            <ArrowRight size={14} />
          </button>
        </Modal>
      )}
      {dialog === "about" && (
        <Modal title="游戏设置与信息" close={() => setDialog(null)}>
          <div className="auth-icon">
            <Monitor size={29} />
          </div>
          <h2>众乐游戏大厅</h2>
          <p>独立棋牌游戏平台，与任何商业联众或 Lianzhong 平台无关联。</p>
          <div className="about-features">
            <span>
              <Check size={14} />
              账号与战绩保存
            </span>
            <span>
              <Check size={14} />
              实时房间和大厅聊天
            </span>
            <span>
              <Check size={14} />
              五子棋、象棋、斗地主与麻将联机、练习
            </span>
            <span>
              <Sparkles size={14} />
              四款经典棋牌已开放
            </span>
          </div>
          <p className="muted">
            v0.1 · 本地开发版
            <br />
            账号和战绩保留，服务重启会清空房间与进行中的棋局。
          </p>
          <div className="dialog-actions">
            <button onClick={toggleMusic}>
              🎵 音乐
              {music ? "已开启" : "已关闭"}
            </button>
            <button onClick={toggleSound}>
              {sound ? <Volume2 size={14} /> : <VolumeX size={14} />}音效
              {sound ? "已开启" : "已关闭"}
            </button>
            {!me?.guest && (
              <button
                disabled={busy || !!activeMatch}
                onClick={() => void logout()}
              >
                退出账号
              </button>
            )}
            <button className="primary" onClick={() => setDialog(null)}>
              回到大厅
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

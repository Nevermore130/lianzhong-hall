import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Maximize2,
  Minus,
  Monitor,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { games, type GameId, type User } from "../shared/protocol.ts";
import { api, enterHall, useHall } from "./lib/client";
import { ToolbarIcon } from "./components/ClientArt";
import { LobbyScene } from "./components/LobbyScene";
import { ServerSidebar } from "./components/ServerSidebar";
import { Modal } from "./components/Modal";
import { Practice } from "./components/Practice";
import { RoomView } from "./components/RoomView";

type Dialog =
  "login" | "register" | "create" | "help" | "about" | "practice" | null;
function savedSound() {
  try {
    return localStorage.getItem("hall:sound") === "on";
  } catch {
    return false;
  }
}
export default function App() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [user, setUser] = useState<User | null>(null),
    [bootError, setBootError] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null),
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
  const [chat, setChat] = useState(""),
    [sound, setSound] = useState(savedSound),
    [minimized, setMinimized] = useState(false);
  const [now, setNow] = useState(new Date()),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState("");
  const { snapshot, status, error, setError, send } = useHall(user, () => {
    setUser(null);
    setBootError("登录已失效，请重新进入大厅");
  });
  const chatEnd = useRef<HTMLDivElement>(null),
    inviteJoined = useRef(false),
    audio = useRef<AudioContext | null>(null);
  const room = snapshot?.rooms.find((r) => r.id === snapshot.roomId),
    me = snapshot?.me ?? user;
  const activeMatch =
    room?.match?.status === "playing" &&
    room.seats.some((s) => s?.userId === me?.id);
  const online = snapshot?.players.filter((p) => p.online) ?? [];
  const connected = status === "connected";
  useEffect(() => {
    let active = true;
    enterHall()
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch((e) => {
        if (active) setBootError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const messages = chatEnd.current?.parentElement;
    if (messages) messages.scrollTop = messages.scrollHeight;
  }, [snapshot?.messages.length]);
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
  function tone() {
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const oscillator = audio.current.createOscillator(),
        gain = audio.current.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.055, audio.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.current.currentTime + 0.14,
      );
      oscillator.connect(gain);
      gain.connect(audio.current.destination);
      oscillator.start();
      oscillator.stop(audio.current.currentTime + 0.15);
    } catch {
      /* Audio is optional. */
    }
  }
  useEffect(() => {
    if (
      sound &&
      room?.match?.lastMove !== null &&
      room?.match?.lastMove !== undefined
    )
      tone();
  }, [room?.match?.id, room?.match?.lastMove, sound]);
  function toggleSound() {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem("hall:sound", next ? "on" : "off");
    } catch {
      /* Optional preference storage. */
    }
    if (next) tone();
  }
  function open(value: Dialog) {
    setFormError("");
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
  async function auth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    const fields = new FormData(event.currentTarget);
    try {
      const result = await api<{ user: User }>(
        dialog === "register" ? "register" : "login",
        { name: fields.get("name"), password: fields.get("password") },
      );
      setUser(result.user);
      setDialog(null);
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await api("logout", {});
      setUser(null);
      const result = await api<{ user: User }>("guest", {});
      setUser(result.user);
      setDialog(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submitChat(event: FormEvent) {
    event.preventDefault();
    if (chat.trim() && send({ type: "chat", text: chat })) setChat("");
  }
  const filteredRooms =
    snapshot?.rooms.filter(
      (r) =>
        (game === "all" || r.game === game) &&
        (!onlyFavorites || favorites.includes(r.id)) &&
        (!hideFull || r.seats.some((s) => !s)) &&
        `${r.name}${r.id}`.includes(search.trim()),
    ) ?? [];
  const currentGame = games.find((g) => g.id === game),
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
            联众游戏大厅 <small>游戏客户端 · 开发版</small>
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
            onClick={() => open(me?.guest ? "login" : "about")}
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
              onClick={() => open(me?.guest ? "register" : "about")}
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
              ◆ 当前开放五子棋，双方入座并准备后开始游戏。
            </span>
            <div className="game-tabs" role="tablist" aria-label="游戏切换">
              {games.map((g) => (
                <button
                  role="tab"
                  aria-selected={
                    game === g.id || (game === "all" && g.id === "gomoku")
                  }
                  key={g.id}
                  className={
                    game === g.id || (game === "all" && g.id === "gomoku")
                      ? "active"
                      : ""
                  }
                  onClick={() => selectGame(g.id)}
                >
                  <span className={`tab-symbol ${g.id}`}>{g.symbol}</span>
                  {g.name}
                </button>
              ))}
            </div>
            <button
              className="mobile-directory"
              onClick={() => setShowSidebar((v) => !v)}
            >
              房间 / 玩家
            </button>
          </div>
          {bootError && (
            <div className="connection-banner" role="alert">
              {bootError}
              <button
                onClick={() => {
                  setBootError("");
                  void enterHall()
                    .then((result) => setUser(result.user))
                    .catch((e) => setBootError(e.message));
                }}
              >
                重新连接
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
                    <b>{currentGame?.name ?? "五子棋"}</b> /{" "}
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
                        const next = snapshot?.rooms.find((r) =>
                          r.seats.some((s) => !s),
                        );
                        if (next) send({ type: "join", roomId: next.id });
                      }}
                    >
                      快速入座
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
                      aria-label={sound ? "关闭音效" : "开启音效"}
                      onClick={toggleSound}
                    >
                      {sound ? <Volume2 size={12} /> : <VolumeX size={12} />}
                    </button>
                  </div>
                )}
                {room && snapshot ? (
                  <div className="live-room-scroll">
                    <RoomView
                      key={room.id}
                      room={room}
                      snapshot={snapshot}
                      send={send}
                      connected={connected}
                    />
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
              <section className="client-chat">
                <div className="chat-tabs">
                  <span>大厅聊天</span>
                  <small>{connected ? "已连接" : "连接中"}</small>
                  <button
                    onClick={() => setChat(chat + " ☺")}
                    aria-label="插入表情"
                  >
                    ☺
                  </button>
                </div>
                <div
                  className="chat-messages"
                  role="log"
                  aria-label="大厅消息"
                  aria-live="polite"
                >
                  {snapshot?.messages
                    .filter((m) => m.userId)
                    .map((message) => (
                      <div className="chat-line" key={message.id}>
                        <time>
                          {new Date(message.time).toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                        <b>
                          {message.name}
                          {message.userId === me?.id ? "[我]" : ""}：
                        </b>
                        <span>{message.text}</span>
                      </div>
                    ))}
                  <div ref={chatEnd} />
                </div>
                <form className="chat-form" onSubmit={submitChat}>
                  <label>
                    对{" "}
                    <select aria-label="聊天对象">
                      <option>所有人</option>
                    </select>{" "}
                    说：
                  </label>
                  <input
                    aria-label="聊天消息"
                    placeholder="输入聊天内容，按 Enter 发送"
                    value={chat}
                    maxLength={200}
                    disabled={!connected}
                    onChange={(e) => setChat(e.target.value)}
                  />
                  <button type="submit" disabled={!connected || !chat.trim()}>
                    发送
                    <Send size={11} />
                  </button>
                </form>
              </section>
            </div>
            <ServerSidebar
              snapshot={snapshot}
              selectedGame={game}
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
              五子棋 · 自由规则 <time>{time}</time>
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
      {dialog === "practice" && <Practice close={() => setDialog(null)} />}
      {(dialog === "login" || dialog === "register") && (
        <Modal
          title={dialog === "register" ? "注册游戏账号" : "账号登录"}
          close={() => setDialog(null)}
        >
          <div className="auth-icon">
            <Monitor size={30} />
          </div>
          <h2>{dialog === "register" ? "注册游戏账号" : "登录游戏大厅"}</h2>
          <p>请输入昵称和密码。账号可保存游戏战绩。</p>
          <form className="auth-form" onSubmit={auth}>
            <label>
              棋友昵称
              <input
                name="name"
                required
                minLength={2}
                maxLength={16}
                placeholder="2–16 位中文、字母或数字"
                autoComplete="username"
              />
            </label>
            <label>
              密码
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                placeholder="至少 8 位"
                autoComplete={
                  dialog === "register" ? "new-password" : "current-password"
                }
              />
            </label>
            {dialog === "register" && (
              <small>新账号拥有独立战绩，游客战绩暂不迁移。</small>
            )}
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button className="primary" type="submit" disabled={busy}>
              {busy
                ? "请稍候…"
                : dialog === "register"
                  ? "注册并进入大厅"
                  : "登录大厅"}
              <ArrowRight size={14} />
            </button>
          </form>
          <button
            className="text-button"
            onClick={() => open(dialog === "register" ? "login" : "register")}
          >
            {dialog === "register"
              ? "已有账号，直接登录"
              : "第一次来？注册一个账号"}
          </button>
        </Modal>
      )}
      {dialog === "create" && (
        <Modal title="创建五子棋房间" close={() => setDialog(null)}>
          <h2>创建游戏桌</h2>
          <p>创建后可复制邀请链接，好友进入后即可入座。</p>
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              const name = new FormData(event.currentTarget).get(
                "roomName",
              ) as string;
              if (send({ type: "create", name, game: "gomoku" }))
                setDialog(null);
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
            <div className="form-game">
              <span className="form-game-icon">● ○</span>
              <span>
                五子棋<small>双人联机 · 自由规则</small>
              </span>
            </div>
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
          <div className="help-note">
            <ShieldCheck size={19} />
            <p>
              刷新页面可恢复座位。断线时暂停落子，30
              秒未回来则判负。对局中离开也会判负。
            </p>
          </div>
          <p className="muted">
            同一浏览器的多个标签页共享账号。测试双人对局，请用普通窗口和无痕窗口，或两种浏览器。
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
          <h2>联众风格游戏大厅</h2>
          <p>经典棋牌客户端界面的独立实现，与联众官方无关联。</p>
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
              五子棋双人对局与观战
            </span>
            <span>
              <Sparkles size={14} />
              更多经典棋牌筹备中
            </span>
          </div>
          <p className="muted">
            v0.1 · 本地开发版
            <br />
            账号和战绩保留，服务重启会清空房间与进行中的棋局。
          </p>
          <div className="dialog-actions">
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

import { MahjongRoomView } from "./components/MahjongRoomView";
import { MahjongPractice } from "./components/MahjongPractice";
import { MahjongRules } from "./components/MahjongRules";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  Languages,
} from "lucide-react";
import { games, type GameId, type User } from "../shared/protocol.ts";
import { api, useHall } from "./lib/client";
import { useIdentity } from "./lib/identity";
import { AuthDialog, type AuthMode } from "./components/AuthDialog";
import { AccountCenter } from "./components/AccountCenter";
import { Leaderboard } from "./components/Leaderboard";
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
import { saveLocale, getCurrentLocale, type Locale } from "./i18n";

type Dialog =
  | AuthMode
  | "account"
  | "create"
  | "help"
  | "about"
  | "practice"
  | "leaderboard"
  | null;
export default function App() {
  useVisualViewport();
  const { t, i18n } = useTranslation();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
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
  function changeLanguage(locale: Locale) {
    void i18n.changeLanguage(locale);
    saveLocale(locale);
    setShowLanguageMenu(false);
  }
  function open(value: Dialog) {
    setDialog(value);
  }
  function selectGame(id: GameId | "all") {
    if (activeMatch) {
      setError(t("finishMatchFirst"));
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
            {t("appName")}
          </span>
          <div className="caption-controls">
            <button
              aria-label={minimized ? t("windowRestore") : t("windowMinimize")}
              onClick={() => setMinimized((v) => !v)}
            >
              <Minus size={12} />
            </button>
            <button
              aria-label={t("windowFullscreen")}
              onClick={() => {
                const action = document.fullscreenElement
                  ? document.exitFullscreen()
                  : document.documentElement.requestFullscreen();
                void action.catch(() => setError(t("fullscreenNotSupported")));
              }}
            >
              <Maximize2 size={10} />
            </button>
            <button aria-label={t("windowHelp")} onClick={() => open("help")}>
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
              <b>{me?.name ?? t("connecting")}</b>
              <small>
                <i
                  className={
                    connected ? "online-indicator" : "offline-indicator"
                  }
                />
                {me?.guest ? t("guest") : t("registeredPlayer")}
              </small>
            </span>
          </button>
          <nav aria-label={t("gameLobby")}>
            <button onClick={() => selectGame("all")}>
              <ToolbarIcon kind="home" />
              <span>{t("gameLobby")}</span>
            </button>
            <button
              disabled={!!activeMatch}
              onClick={() => open(me?.guest ? "register" : "account")}
            >
              <ToolbarIcon kind="account" />
              <span>{me?.guest ? t("registerAccount") : t("myAccount")}</span>
            </button>
            <button onClick={() => open("practice")}>
              <ToolbarIcon kind="practice" />
              <span>{t("practiceMode")}</span>
            </button>
            <button onClick={() => open("leaderboard")}>
              <ToolbarIcon kind="star" />
              <span>排行榜</span>
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
              <span>{t("myFavorites")}</span>
            </button>
            <div className="language-switcher" style={{ position: "relative" }}>
              <button
                onClick={() => setShowLanguageMenu((v) => !v)}
                aria-label={t("language")}
                title={t("language")}
              >
                <Languages size={13} />
                <span>{t("language")}</span>
              </button>
              {showLanguageMenu && (
                <div
                  className="language-menu"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    background: "#c0c0c0",
                    border: "2px outset #fff",
                    boxShadow: "2px 2px 0 rgba(0,0,0,0.3)",
                    zIndex: 1000,
                    minWidth: "120px",
                  }}
                >
                  <button
                    onClick={() => changeLanguage("zh-CN")}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "4px 8px",
                      border: "none",
                      background: getCurrentLocale() === "zh-CN" ? "#000080" : "transparent",
                      color: getCurrentLocale() === "zh-CN" ? "#fff" : "#000",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    {t("languageZhCN")}
                  </button>
                  <button
                    onClick={() => changeLanguage("yue")}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "4px 8px",
                      border: "none",
                      background: getCurrentLocale() === "yue" ? "#000080" : "transparent",
                      color: getCurrentLocale() === "yue" ? "#fff" : "#000",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    {t("languageYue")}
                  </button>
                  <button
                    onClick={() => changeLanguage("en")}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "4px 8px",
                      border: "none",
                      background: getCurrentLocale() === "en" ? "#000080" : "transparent",
                      color: getCurrentLocale() === "en" ? "#fff" : "#000",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    {t("languageEn")}
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => open("about")}>
              <ToolbarIcon kind="settings" />
              <span>{t("gameSettings")}</span>
            </button>
            <button onClick={() => open("help")}>
              <ToolbarIcon kind="help" />
              <span>{t("gameHelp")}</span>
            </button>
            <button
              disabled={!!activeMatch || busy}
              onClick={() => {
                if (me?.guest) setMinimized(true);
                else void logout();
              }}
            >
              <ToolbarIcon kind="exit" />
              <span>{me?.guest ? t("exitLobby") : t("logoutAccount")}</span>
            </button>
          </nav>
          <div className="header-account">
            <span>{t("onlinePlayers", { count: online.length })}</span>
            <button disabled={!!activeMatch} onClick={() => open("login")}>
              {t("switchAccount")}
            </button>
          </div>
        </div>
      </header>
      {minimized ? (
        <div className="restore-window">
          <Monitor size={25} />
          <span>{t("windowRestoreText")}</span>
          <button onClick={() => setMinimized(false)}>{t("windowRestoreButton")}</button>
        </div>
      ) : (
        <>
          <div className="client-tabbar">
            <span className="announcement">
              {t("announcement")}
            </span>
            <div className="game-tabs" role="tablist" aria-label={t("gameLobby")}>
              {games.map((g) => (
                <button
                  role="tab"
                  aria-selected={selectedGame === g.id}
                  key={g.id}
                  className={selectedGame === g.id ? "active" : ""}
                  onClick={() => selectGame(g.id)}
                >
                  <span className={`tab-symbol ${g.id}`}>{g.symbol}</span>
                  {t(g.id)}
                </button>
              ))}
            </div>
            <button
              className="mobile-directory"
              aria-expanded={showSidebar}
              onClick={() => setShowSidebar((v) => !v)}
            >
              {showSidebar ? t("backToTable") : t("mobileDirectory")}
            </button>
          </div>
          {bootError && (
            <div className="connection-banner" role="alert">
              {bootError}
              <button onClick={() => open("login")}>{t("relogin")}</button>
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
                {t("guestEnter")}
              </button>
            </div>
          )}
          {!connected && user && (
            <div className="connection-banner" role="status">
              {t("connectionLost")}
            </div>
          )}
          <div
            className={`client-layout ${showSidebar ? "show-directory" : ""}`}
          >
            <div className="client-left">
              <section className="table-pane">
                <div className="hall-menubar">
                  <span>
                    <b>{currentGame ? t(currentGame.id) : t("allGames")}</b> /{" "}
                    {room
                      ? room.name
                      : onlyFavorites
                        ? t("favoriteRooms")
                        : t("leisureHall")}
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
                      {t("quickJoinTable")}
                    </button>
                    <button
                      disabled={
                        !connected ||
                        !!activeMatch ||
                        !!(currentGame && !currentGame.available)
                      }
                      onClick={() => open("create")}
                    >
                      {t("createRoom")}
                    </button>
                    <button onClick={() => open("help")}>{t("gameRules")}</button>
                  </div>
                </div>
                {!room && (
                  <div className="hall-filterbar">
                    <label className="hall-search">
                      <Search size={11} />
                      <input
                        aria-label={t("searchRoom")}
                        placeholder={t("searchPlaceholder")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {search && (
                        <button
                          aria-label={t("clearSearch")}
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
                      {t("hideFull")}
                    </label>
                    <span>{t("tableCountDisplay", { count: filteredRooms.length })}</span>
                    <button
                      className="sound-toggle"
                      aria-label={music ? t("disableMusic") : t("enableMusic")}
                      onClick={toggleMusic}
                      title={music ? t("musicEnabled") : t("musicDisabled")}
                    >
                      🎵
                    </button>
                    <button
                      className="sound-toggle"
                      aria-label={sound ? t("disableSound") : t("enableSound")}
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
                    gameName={currentGame ? t(currentGame.id) : t("gomoku")}
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
                  <p className="chat-empty">{t("chatPlaceholder")}</p>
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
              {connected ? t("connected") : t("connecting")}　{t("onlineCount", { count: online.length })}
              　{t("tableCount", { count: snapshot?.rooms.length ?? 0 })}
            </span>
            <span>
              {currentGame?.id === "mahjong"
                ? t("mahjongRules")
                : currentGame?.id === "doudizhu"
                  ? t("doudizhuRules")
                  : currentGame?.id === "xiangqi"
                    ? t("xiangqiRules")
                    : t("gomokuRules")}{" "}
              <time>{time}</time>
            </span>
          </footer>
        </>
      )}
      {error && (
        <div className="toast" role="alert">
          <CircleHelp size={16} />
          {error}
          <button onClick={() => setError("")}>{t("closeError")}</button>
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
      {dialog === "leaderboard" && (
        <Leaderboard close={() => setDialog(null)} />
      )}
      {dialog === "create" && (
        <Modal title={t("createRoomTitle")} close={() => setDialog(null)}>
          <h2>{t("createRoomHeading")}</h2>
          <p>{t("createRoomDescription")}</p>
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
              {t("roomName")}
              <input
                name="roomName"
                placeholder={t("roomNamePlaceholder")}
                required
                minLength={2}
                maxLength={16}
              />
            </label>
            <label>
              {t("game")}
              <select
                name="game"
                defaultValue={
                  currentGame?.available ? currentGame.id : "gomoku"
                }
              >
                <option value="gomoku">{t("gomokuDouble")}</option>
                <option value="xiangqi">{t("xiangqiDouble")}</option>
                <option value="mahjong">{t("mahjongFour")}</option>
                <option value="doudizhu">{t("doudizhuThree")}</option>
              </select>
            </label>
            <button type="submit" className="primary" disabled={!connected}>
              <Plus size={15} />
              {t("createButton")}
            </button>
          </form>
        </Modal>
      )}
      {dialog === "help" && (
        <Modal title={t("helpTitle")} close={() => setDialog(null)}>
          <h2>{t("helpHeading")}</h2>
          {currentGame?.id === "mahjong" ? (
            <MahjongRules />
          ) : currentGame?.id === "doudizhu" ? (
            <ul className="ddz-rule-list">
              <li>{t("ddzHelp1")}</li>
              <li>{t("ddzHelp2")}</li>
              <li>{t("ddzHelp3")}</li>
              <li>{t("ddzHelp4")}</li>
              <li>{t("ddzHelp5")}</li>
              <li>{t("ddzHelp6")}</li>
              <li>{t("ddzHelp7")}</li>
            </ul>
          ) : currentGame?.id === "xiangqi" ? (
            <ul className="ddz-rule-list">
              <li>{t("xqHelp1")}</li>
              <li>{t("xqHelp2")}</li>
              <li>{t("xqHelp3")}</li>
              <li>{t("xqHelp4")}</li>
              <li>{t("xqHelp5")}</li>
            </ul>
          ) : (
            <>
              <ol className="help-steps">
                <li>
                  <strong>{t("helpStep1Title")}</strong>
                  <p>{t("helpStep1Desc")}</p>
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
            <p>{t("helpNote")}</p>
          </div>
          <p className="muted">{t("helpSameDevice")}</p>
          <button
            className="primary full-width"
            onClick={() => open("practice")}
          >
            {t("practiceWithComputer")}
            <ArrowRight size={14} />
          </button>
        </Modal>
      )}
      {dialog === "about" && (
        <Modal title={t("aboutTitle")} close={() => setDialog(null)}>
          <div className="auth-icon">
            <Monitor size={29} />
          </div>
          <h2>{t("aboutHeading")}</h2>
          <p>{t("aboutDescription")}</p>
          <div className="about-features">
            <span>
              <Check size={14} />
              {t("feature1")}
            </span>
            <span>
              <Check size={14} />
              {t("feature2")}
            </span>
            <span>
              <Check size={14} />
              {t("feature3")}
            </span>
            <span>
              <Sparkles size={14} />
              {t("feature4")}
            </span>
          </div>
          <p className="muted">
            {t("versionNote")}
            <br />
            {t("versionDetail")}
          </p>
          <div className="dialog-actions">
            <button onClick={toggleMusic}>
              🎵 {t("musicStatus", { status: music ? t("statusEnabled") : t("statusDisabled") })}
            </button>
            <button onClick={toggleSound}>
              {sound ? <Volume2 size={14} /> : <VolumeX size={14} />}{t("soundStatus", { status: sound ? t("statusEnabled") : t("statusDisabled") })}
            </button>
            {!me?.guest && (
              <button
                disabled={busy || !!activeMatch}
                onClick={() => void logout()}
              >
                {t("logout")}
              </button>
            )}
            <button className="primary" onClick={() => setDialog(null)}>
              {t("backToLobby2")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Send } from "lucide-react";
import type { User } from "../../shared/protocol.ts";
import type {
  ChatChannel,
  ChatMessage,
  ChatPage,
  ChatSnapshot,
} from "../../shared/chat.ts";
import { api } from "../lib/client";
import { Modal } from "./Modal";
import { mergeMessages, mergeHistory, nearBottom } from "../lib/chat-state";
import { useChatOutbox, type ChatTransport } from "../lib/useChatOutbox";
import { EmojiPicker } from "./EmojiPicker";
import { parseStickers } from "../lib/stickers";

type History = { messages: ChatMessage[]; hasMore: boolean };
const time = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
export function ChatPanel({
  user,
  snapshot,
  connected,
  reading,
  send,
  subscribe,
}: {
  user: User;
  snapshot: ChatSnapshot | null;
  connected: boolean;
  reading: boolean;
} & ChatTransport) {
  const roomChannel = snapshot?.room?.channel ?? null;
  const [channel, setChannel] = useState<ChatChannel>(roomChannel ?? "hall");
  const [histories, setHistories] = useState<
    Partial<Record<ChatChannel, History>>
  >({});
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    try {
      const parsed: unknown = JSON.parse(
        sessionStorage.getItem(`hall:drafts:${user.id}`) ?? "{}",
      );
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? Object.fromEntries(
            Object.entries(parsed).filter(
              ([key, value]) =>
                (key === "hall" || /^room:[0-9]{4,12}$/.test(key)) &&
                typeof value === "string" &&
                value.length <= 200,
            ),
          )
        : {};
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [atBottom, setAtBottom] = useState(true),
    [visible, setVisible] = useState(document.visibilityState === "visible");
  const [readRetry, setReadRetry] = useState(0);
  const [showOutbox, setShowOutbox] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const composerRef = useRef<HTMLInputElement>(null);
  const viewport = useRef<HTMLDivElement>(null),
    pinned = useRef(true),
    active = useRef(channel),
    allowedRoom = useRef(roomChannel);
  const prepend = useRef<{
      channel: ChatChannel;
      height: number;
      top: number;
    } | null>(null),
    previousChannel = useRef<ChatChannel | null>(null),
    revision = useRef(snapshot?.revision);
  const requestGeneration = useRef(0);
  active.current = channel;
  allowedRoom.current = roomChannel;
  const box = useChatOutbox(user, connected, { send, subscribe }, (message) => {
    if (message.channel !== "hall" && message.channel !== allowedRoom.current)
      return;
    setHistories((old) => ({
      ...old,
      [message.channel]: {
        messages: mergeMessages(old[message.channel]?.messages ?? [], [
          message,
        ]),
        hasMore: old[message.channel]?.hasMore ?? false,
      },
    }));
  });
  useEffect(() => {
    setChannel(roomChannel ?? "hall");
    setError("");
    setLoading(false);
    requestGeneration.current++;
    setHistories((old) =>
      Object.fromEntries(
        Object.entries(old).filter(
          ([key]) => key === "hall" || key === roomChannel,
        ),
      ),
    );
  }, [roomChannel]);
  useEffect(() => {
    if (!snapshot) return;
    const reset = revision.current !== snapshot.revision;
    revision.current = snapshot.revision;
    if (reset) {
      requestGeneration.current++;
      setLoading(false);
      prepend.current = null;
    }
    const pages = [snapshot.hall, ...(snapshot.room ? [snapshot.room] : [])];
    setHistories((old) => {
      const next = reset ? {} : { ...old };
      for (const page of pages) {
        next[page.channel] = mergeHistory(next[page.channel], page);
      }
      return next;
    });
    box.confirm(pages.flatMap((page) => page.messages));
  }, [snapshot, box.confirm]);
  useEffect(() => {
    try {
      sessionStorage.setItem(`hall:drafts:${user.id}`, JSON.stringify(drafts));
    } catch {
      /* Draft remains available in memory. */
    }
  }, [drafts, user.id]);
  useEffect(() => {
    const changed = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (pinned.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const history = histories[channel],
    messages = history?.messages ?? [],
    pending = box.outbox.filter((m) => m.channel === channel);
  const page = channel === "hall" ? snapshot?.hall : snapshot?.room;
  const unread = page?.channel === channel ? page.unread : 0;
  const latest = messages.at(-1)?.seq ?? 0;
  const canUseChannel = channel === "hall" || (roomChannel !== null && channel === roomChannel);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    if (previousChannel.current !== channel) {
      element.scrollTop = element.scrollHeight;
      pinned.current = true;
      setAtBottom(true);
      prepend.current = null;
      previousChannel.current = channel;
    } else if (prepend.current?.channel === channel) {
      element.scrollTop =
        prepend.current.top + element.scrollHeight - prepend.current.height;
      prepend.current = null;
      pinned.current = nearBottom(
        element.scrollTop,
        element.scrollHeight,
        element.clientHeight,
      );
      setAtBottom(pinned.current);
    } else if (pinned.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [channel, messages, pending.length]);
  useEffect(() => {
    if (
      !connected ||
      !reading ||
      showOutbox ||
      !visible ||
      !atBottom ||
      !latest ||
      !unread ||
      !canUseChannel
    )
      return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    void api("chat/read", { channel, through: latest }).catch(() => {
      if (active) retry = setTimeout(() => setReadRetry((n) => n + 1), 3000);
    });
    return () => {
      active = false;
      clearTimeout(retry);
    };
  }, [
    connected,
    reading,
    showOutbox,
    visible,
    atBottom,
    latest,
    unread,
    channel,
    canUseChannel,
    readRetry,
  ]);
  async function older() {
    if (loading || !history?.hasMore || !messages[0]) return;
    const target = channel,
      generation = requestGeneration.current;
    setLoading(true);
    setError("");
    try {
      const result = await api<ChatPage>(
        `chat/history?channel=${encodeURIComponent(target)}&before=${messages[0].seq}`,
      );
      if (
        generation !== requestGeneration.current ||
        (target !== "hall" && target !== allowedRoom.current)
      )
        return;
      if (active.current === target && viewport.current)
        prepend.current = {
          channel: target,
          height: viewport.current.scrollHeight,
          top: viewport.current.scrollTop,
        };
      setHistories((old) => ({
        ...old,
        [target]: {
          messages: mergeMessages(result.messages, old[target]?.messages ?? []),
          hasMore: result.hasMore,
        },
      }));
    } catch (error) {
      if (generation === requestGeneration.current)
        setError((error as Error).message);
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }
  function draft(text: string) {
    setDrafts((old) => ({ ...old, [channel]: text.slice(0, 200) }));
  }
  function insertSticker(shortcode: string) {
    const input = composerRef.current;
    if (!input) {
      draft((drafts[channel] ?? "") + shortcode);
      return;
    }
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const currentText = drafts[channel] ?? "";
    const before = currentText.slice(0, start);
    const after = currentText.slice(end);
    const newText = before + shortcode + after;
    draft(newText);
    // Restore cursor position after sticker shortcode
    setTimeout(() => {
      const newPosition = start + shortcode.length;
      input.setSelectionRange(newPosition, newPosition);
      input.focus();
    }, 0);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const text = (drafts[channel] ?? "").trim();
    if (!text) {
      setError("请输入消息内容");
      return;
    }
    if (!canUseChannel) {
      setError("当前频道不可用，请切换到大厅或回到房间后再发送");
      return;
    }
    if (!box.sendMessage(channel, text)) {
      setError("待处理消息已达 50 条，请重试或移除旧消息后再发送");
      return;
    }
    draft("");
    setError("");
    pinned.current = true;
    setAtBottom(true);
  }
  function bottom() {
    if (viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
    pinned.current = true;
    setAtBottom(true);
  }
  return (
    <section className="client-chat enhanced-chat" aria-label="聊天面板">
      <div className="chat-tabs">
        <div role="tablist" aria-label="聊天频道">
          <button
            role="tab"
            aria-selected={channel === "hall"}
            onClick={() => {
              setChannel("hall");
              setError("");
            }}
          >
            大厅聊天
            {snapshot?.hall.unread ? (
              <em>
                {snapshot.hall.unread > 99 ? "99+" : snapshot.hall.unread}
              </em>
            ) : null}
          </button>
          <button
            role="tab"
            aria-selected={channel !== "hall"}
            disabled={!roomChannel}
            onClick={() => {
              if (roomChannel) setChannel(roomChannel);
              setError("");
            }}
          >
            房间聊天
            {snapshot?.room?.unread ? (
              <em>
                {snapshot.room.unread > 99 ? "99+" : snapshot.room.unread}
              </em>
            ) : null}
          </button>
        </div>
        <small>{connected ? "已连接" : "连接中"}</small>
        {box.outbox.some((message) => message.channel !== channel) && (
          <button
            className="chat-outbox-button"
            onClick={() => setShowOutbox(true)}
          >
            待发 {box.outbox.length}
          </button>
        )}
        <button
          className="chat-emoticon"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          aria-label="插入表情"
        >
          😀
        </button>
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={insertSticker}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </div>
      <div className="chat-scroll-wrap">
        <div
          ref={viewport}
          className="chat-messages"
          role="log"
          aria-label={channel === "hall" ? "大厅消息" : "房间消息"}
          aria-live="polite"
          tabIndex={0}
          onScroll={() => {
            const element = viewport.current!;
            pinned.current = nearBottom(
              element.scrollTop,
              element.scrollHeight,
              element.clientHeight,
            );
            setAtBottom(pinned.current);
          }}
        >
          <div className="chat-history-control">
            {history?.hasMore ? (
              <button
                disabled={loading || !connected}
                onClick={() => void older()}
              >
                {loading ? "正在加载…" : "加载更早消息"}
              </button>
            ) : (
              <span>
                {messages.length
                  ? "以上是全部历史消息"
                  : connected
                    ? "暂无消息，和棋友打个招呼吧"
                    : "正在连接聊天…"}
              </span>
            )}
          </div>
          {messages.map((message, index) => (
            <div key={message.id}>
              {(index === 0 ||
                new Date(messages[index - 1].time).toDateString() !==
                  new Date(message.time).toDateString()) && (
                <div className="chat-date">
                  {new Date(message.time).toLocaleDateString("zh-CN")}
                </div>
              )}
              <div className="chat-line" data-message-id={message.id}>
                <time title={new Date(message.time).toLocaleString("zh-CN")}>
                  {time(message.time)}
                </time>
                <b title={message.name}>
                  {message.name}
                  {message.userId === user.id ? "[我]" : ""}：
                </b>
                <span
                  className="chat-text"
                  dangerouslySetInnerHTML={{ __html: parseStickers(message.text) }}
                />
                {message.userId === user.id && (
                  <small className="chat-sent">已发送</small>
                )}
              </div>
            </div>
          ))}
          {pending.map((message) => (
            <div
              className={`chat-pending ${message.status}`}
              key={message.clientId}
            >
              <div className="chat-line">
                <time>{time(message.time)}</time>
                <b>{user.name}[我]：</b>
                <span
                  className="chat-text"
                  dangerouslySetInnerHTML={{ __html: parseStickers(message.text) }}
                />
                <small>
                  {message.status === "sending" ? "发送中…" : "发送失败"}
                </small>
              </div>
              {message.status === "failed" && (
                <div className="chat-retry">
                  <span>{message.error}</span>
                  <button
                    disabled={!connected || !canUseChannel}
                    onClick={() => box.retry(message.clientId)}
                  >
                    重试
                  </button>
                  <button
                    onClick={() => {
                      draft(message.text);
                      box.discard(message.clientId);
                    }}
                  >
                    编辑
                  </button>
                  <button onClick={() => box.discard(message.clientId)}>
                    移除
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {!atBottom && (
          <button className="chat-new-messages" onClick={bottom}>
            {unread ? `${unread} 条未读消息 ↓` : "回到最新消息 ↓"}
          </button>
        )}
      </div>
      {error && (
        <div className="chat-error" role="alert">
          {error}
          <button onClick={() => setError("")}>关闭</button>
        </div>
      )}
      <form className="chat-form" onSubmit={submit}>
        <label htmlFor="chat-composer">
          {channel === "hall" ? "对大厅" : `对 ${channel.slice(5)} 桌`}说：
        </label>
        <input
          ref={composerRef}
          id="chat-composer"
          aria-label="聊天消息"
          placeholder={connected ? "输入消息…" : "连接中，待发送内容会保留"}
          value={drafts[channel] ?? ""}
          maxLength={200}
          enterKeyHint="send"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.blur();
            }
          }}
          onChange={(event) => draft(event.target.value)}
        />
        <button
          type="submit"
          disabled={!(drafts[channel] ?? "").trim()}
        >
          发送
          <Send size={11} />
        </button>
      </form>
      {showOutbox && (
        <Modal title="待发送消息" close={() => setShowOutbox(false)}>
          <p>
            消息保留在原频道。房间消息需要回到对应房间后重试，也可以复制原文或移除。
          </p>
          <div className="outbox-list">
            {box.outbox.map((message) => (
              <article key={message.clientId}>
                <strong>
                  {message.channel === "hall"
                    ? "大厅"
                    : `房间 ${message.channel.slice(5)}`}
                </strong>
                <p>{message.text}</p>
                <small>
                  {message.status === "sending" ? "发送中…" : message.error}
                </small>
                <div>
                  <button
                    disabled={
                      !connected ||
                      message.status === "sending" ||
                      (message.channel !== "hall" &&
                        message.channel !== roomChannel)
                    }
                    onClick={() => box.retry(message.clientId)}
                  >
                    重试
                  </button>
                  <button
                    onClick={() => {
                      draft(message.text);
                      setShowOutbox(false);
                    }}
                  >
                    复制到当前输入框
                  </button>
                  <button onClick={() => box.discard(message.clientId)}>
                    移除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
}

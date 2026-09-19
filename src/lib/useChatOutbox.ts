import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatChannel,
  ChatMessage,
  OutgoingMessage,
} from "../../shared/chat.ts";
import type { Command, ServerEvent, User } from "../../shared/protocol.ts";
import { confirmedOutbox, restoreOutbox } from "./chat-state";
import { generateUUID } from "./uuid";

export type ChatTransport = {
  send: (command: Command, quiet?: boolean) => boolean;
  subscribe: (listener: (event: ServerEvent) => void) => () => void;
};
export function useChatOutbox(
  user: User,
  connected: boolean,
  transport: ChatTransport,
  confirmed: (message: ChatMessage) => void,
) {
  const key = `hall:outbox:${user.id}`;
  const [outbox, setOutbox] = useState<OutgoingMessage[]>(() => {
    try {
      return restoreOutbox(sessionStorage.getItem(key));
    } catch {
      return [];
    }
  });
  const queue = useRef(outbox),
    timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const onConfirmed = useRef(confirmed);
  onConfirmed.current = confirmed;
  const update = useCallback(
    (change: (old: OutgoingMessage[]) => OutgoingMessage[]) => {
      const next = change(queue.current);
      queue.current = next;
      setOutbox(next);
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* In-memory retry remains available. */
      }
    },
    [key],
  );
  const clearTimer = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);
  const confirm = useCallback(
    (messages: ChatMessage[]) => {
      const next = confirmedOutbox(queue.current, messages, user.id);
      if (next.length === queue.current.length) return;
      for (const message of queue.current)
        if (!next.includes(message)) clearTimer(message.clientId);
      update(() => next);
    },
    [user.id, update, clearTimer],
  );
  useEffect(
    () =>
      transport.subscribe((event) => {
        if (event.type === "chat:ack" && event.message.userId === user.id) {
          confirm([event.message]);
          onConfirmed.current(event.message);
        } else if (event.type === "chat:error") {
          clearTimer(event.clientId);
          update((old) =>
            old.map((message) =>
              message.clientId === event.clientId
                ? { ...message, status: "failed", error: event.message }
                : message,
            ),
          );
        } else if (event.type === "snapshot")
          confirm([
            ...event.chat.hall.messages,
            ...(event.chat.room?.messages ?? []),
          ]);
      }),
    [transport.subscribe, user.id, confirm, update, clearTimer],
  );
  useEffect(() => {
    if (connected) return;
    for (const id of timers.current.keys()) clearTimer(id);
    update((old) =>
      old.map((message) =>
        message.status === "sending"
          ? { ...message, status: "failed", error: "连接已断开，请恢复后重试" }
          : message,
      ),
    );
  }, [connected, update, clearTimer]);
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
    },
    [],
  );
  function transmit(message: OutgoingMessage) {
    clearTimer(message.clientId);
    const sent = transport.send(
      {
        type: "chat",
        text: message.text,
        channel: message.channel,
        clientId: message.clientId,
      },
      true,
    );
    if (!sent) {
      update((old) =>
        old.map((item) =>
          item.clientId === message.clientId
            ? {
                ...item,
                status: "failed",
                error: "当前未连接，内容已保留，连接后可重试",
              }
            : item,
        ),
      );
      return;
    }
    timers.current.set(
      message.clientId,
      setTimeout(() => {
        timers.current.delete(message.clientId);
        update((old) =>
          old.map((item) =>
            item.clientId === message.clientId
              ? {
                  ...item,
                  status: "failed",
                  error: "尚未收到发送确认，可以重试",
                }
              : item,
          ),
        );
      }, 8000),
    );
  }
  function sendMessage(channel: ChatChannel, text: string) {
    if (queue.current.length >= 50) return false;
    const message: OutgoingMessage = {
      clientId: generateUUID(),
      channel,
      text: text.trim(),
      time: Date.now(),
      status: "sending",
    };
    update((old) => [...old, message]);
    transmit(message);
    return true;
  }
  function retry(clientId: string) {
    const message = queue.current.find((m) => m.clientId === clientId);
    if (!message || message.status === "sending") return;
    update((old) =>
      old.map((m) =>
        m.clientId === clientId
          ? { ...m, status: "sending", error: undefined }
          : m,
      ),
    );
    transmit(message);
  }
  function discard(clientId: string) {
    clearTimer(clientId);
    update((old) => old.filter((m) => m.clientId !== clientId));
  }
  return { outbox, sendMessage, retry, discard, confirm };
}

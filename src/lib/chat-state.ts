import type {
  ChatMessage,
  ChatPage,
  OutgoingMessage,
} from "../../shared/chat.ts";

export type ChatHistory = { messages: ChatMessage[]; hasMore: boolean };
export function mergeHistory(
  previous: ChatHistory | undefined,
  page: ChatPage,
): ChatHistory {
  const gap =
    page.hasMore &&
    !!previous?.messages.length &&
    !!page.messages.length &&
    previous.messages.at(-1)!.seq < page.messages[0].seq;
  if (!previous || gap)
    return { messages: page.messages, hasMore: page.hasMore };
  const hasOlder =
    !!previous.messages.length &&
    previous.messages[0].seq < (page.messages[0]?.seq ?? Infinity);
  return {
    messages: mergeMessages(previous.messages, page.messages),
    hasMore: hasOlder ? previous.hasMore : page.hasMore,
  };
}

export function mergeMessages(
  previous: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const messages = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((a, b) => a.seq - b.seq);
}
export function confirmedOutbox(
  outbox: OutgoingMessage[],
  messages: ChatMessage[],
  userId: string,
) {
  const ids = new Set(
    messages.filter((m) => m.userId === userId).map((m) => m.clientId),
  );
  return outbox.filter((message) => !ids.has(message.clientId));
}
export function restoreOutbox(raw: string | null): OutgoingMessage[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (m): m is OutgoingMessage =>
          !!m &&
          typeof m.clientId === "string" &&
          /^[a-f0-9-]{36}$/i.test(m.clientId) &&
          typeof m.text === "string" &&
          !!m.text.trim() &&
          m.text.length <= 200 &&
          (m.channel === "hall" || /^room:[0-9]{4,12}$/.test(m.channel)) &&
          Number.isFinite(m.time),
      )
      .slice(-50)
      .map((m) => ({
        ...m,
        status: "failed",
        error: "上次发送尚未确认，请重试",
      }));
  } catch {
    return [];
  }
}
export const nearBottom = (
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
) => scrollHeight - scrollTop - clientHeight <= 24;

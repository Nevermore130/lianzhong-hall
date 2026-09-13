export type ChatChannel = "hall" | `room:${string}`;
export type ChatMessage = {
  id: string;
  seq: number;
  clientId: string;
  channel: ChatChannel;
  userId: string;
  name: string;
  text: string;
  time: number;
};
export type ChatPage = {
  channel: ChatChannel;
  messages: ChatMessage[];
  hasMore: boolean;
  unread: number;
};
export type ChatSnapshot = {
  revision: number;
  hall: ChatPage;
  room: ChatPage | null;
};
export type OutgoingMessage = {
  clientId: string;
  channel: ChatChannel;
  text: string;
  time: number;
  status: "sending" | "failed";
  error?: string;
};

import type { User } from "./protocol.ts";

export const avatars = [
  "经典棋友",
  "青竹",
  "紫兰",
  "赤枫",
  "金秋",
  "墨松",
] as const;
export type AccountProfile = User & { email: string | null; createdAt: number };
export type DeviceSession = {
  id: string;
  device: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  current: boolean;
};
export type MailMode = "local" | "smtp" | "disabled";

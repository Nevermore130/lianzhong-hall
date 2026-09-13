import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Command,
  ServerEvent,
  Snapshot,
  User,
} from "../../shared/protocol.ts";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: data === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      result.error ?? "连接失败，请稍后重试",
      response.status,
      result.retryAfter,
    );
  return result;
}
let boot: Promise<{ user: User }> | undefined;
export function enterHall() {
  if (!boot)
    boot = api<{ user: User | null }>("me")
      .then((result) =>
        result.user ? { user: result.user } : api<{ user: User }>("guest", {}),
      )
      .finally(() => {
        boot = undefined;
      });
  return boot;
}
export function useHall(user: User | null, expired: () => void, revision = 0) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "offline">(
    "connecting",
  );
  const [error, setError] = useState("");
  const socket = useRef<WebSocket | null>(null),
    onExpired = useRef(expired);
  const listeners = useRef(new Set<(event: ServerEvent) => void>());
  onExpired.current = expired;
  useEffect(() => {
    setSnapshot(null);
    if (!user) return;
    let stopped = false,
      attempts = 0,
      timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      if (stopped) return;
      setStatus("connecting");
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
      );
      socket.current = ws;
      ws.onopen = () => {
        if (stopped) {
          ws.close();
          return;
        }
        attempts = 0;
        setStatus("connected");
      };
      ws.onmessage = (event) => {
        if (stopped) return;
        try {
          const data = JSON.parse(event.data) as ServerEvent;
          if (data.type === "snapshot") setSnapshot(data);
          else if (data.type === "error") setError(data.message);
          for (const listener of listeners.current) listener(data);
        } catch {
          setError("收到无法识别的服务器消息");
        }
      };
      ws.onclose = (event) => {
        if (stopped) return;
        setStatus("offline");
        if (event.code === 4001) {
          onExpired.current();
          return;
        }
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 10_000));
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket.current?.close();
      socket.current = null;
    };
  }, [user?.id, revision]);
  const send = useCallback((command: Command, quiet = false) => {
    if (socket.current?.readyState !== WebSocket.OPEN) {
      if (!quiet) setError("连接恢复中，请稍后再试");
      return false;
    }
    socket.current.send(JSON.stringify(command));
    return true;
  }, []);
  const subscribe = useCallback((listener: (event: ServerEvent) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);
  return { snapshot, status, error, setError, send, subscribe };
}

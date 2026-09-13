import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "../../shared/protocol.ts";
import { api, ApiError, enterHall } from "./client";

export function useIdentity() {
  const [user, setUser] = useState<User | null>(null);
  const [bootError, setBootError] = useState("");
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const current = useRef(user);
  current.current = user;
  const accept = useCallback((next: User | null, broadcast = true) => {
    generation.current++;
    current.current = next;
    setUser(next);
    setBootError(next ? "" : "登录已失效，请重新登录，或以游客身份进入");
    setRevision((value) => value + 1);
    if (broadcast) channel.current?.postMessage("identity-changed");
  }, []);
  const reconcile = useCallback(
    async (broadcast = false) => {
      const version = generation.current;
      try {
        const result = await api<{ user: User | null }>("me");
        if (version === generation.current) accept(result.user, broadcast);
      } catch {
        if (version === generation.current)
          setBootError("无法确认登录状态，请检查连接后重试");
      }
    },
    [accept],
  );
  useEffect(() => {
    let active = true;
    const version = generation.current;
    enterHall()
      .then(({ user }) => {
        if (active && version === generation.current) accept(user, false);
      })
      .catch((error: Error) => {
        if (active) setBootError(error.message);
      });
    return () => {
      active = false;
    };
  }, [accept]);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const connection = new BroadcastChannel("hall:identity");
    channel.current = connection;
    connection.onmessage = () => {
      void reconcile();
    };
    return () => {
      channel.current = null;
      connection.close();
    };
  }, [reconcile]);
  useEffect(() => {
    let pending = false;
    const renew = async () => {
      if (pending || !current.current || document.visibilityState !== "visible")
        return;
      pending = true;
      const version = generation.current;
      try {
        const { user: next } = await api<{ user: User }>("session/refresh", {});
        if (version === generation.current) {
          if (
            next.id !== current.current?.id ||
            next.guest !== current.current?.guest
          )
            accept(next, false);
          else {
            current.current = next;
            setUser(next);
          }
        }
      } catch (error) {
        if (
          version === generation.current &&
          error instanceof ApiError &&
          error.status === 401
        )
          await reconcile();
      } finally {
        pending = false;
      }
    };
    const timer = setInterval(() => {
      void renew();
    }, 5 * 60_000);
    window.addEventListener("focus", renew);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", renew);
    };
  }, [accept, reconcile]);
  return { user, bootError, revision, accept, reconcile };
}

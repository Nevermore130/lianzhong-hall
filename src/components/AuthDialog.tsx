import { useEffect, useState, type FormEvent } from "react";
import type { User } from "../../shared/protocol.ts";
import type { MailMode } from "../../shared/accounts.ts";
import { api } from "../lib/client";
import { Modal } from "./Modal";

export type AuthMode = "login" | "register" | "forgot" | "reset" | "verify";
export type MailConfig = { mailMode: MailMode; inboxUrl?: string };
export function MailNotice({ config }: { config: MailConfig | null }) {
  return config?.mailMode === "local" && config.inboxUrl ? (
    <p className="mail-notice">
      本地验收：验证邮件可在本机收件箱查看。
      <a href={config.inboxUrl} target="_blank" rel="noreferrer">
        打开本地收件箱 ↗
      </a>
    </p>
  ) : config?.mailMode === "disabled" ? (
    <p className="mail-notice">
      邮件服务尚未配置，暂时无法验证邮箱和找回密码。
    </p>
  ) : null;
}
export function PasswordField({
  label,
  name,
  fresh = false,
}: {
  label: string;
  name: string;
  fresh?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type="password"
        required
        minLength={fresh ? 8 : undefined}
        maxLength={72}
        autoComplete={fresh ? "new-password" : "current-password"}
        placeholder={fresh ? "8–72 位密码" : "请输入当前密码"}
      />
    </label>
  );
}
export function AuthDialog({
  mode,
  token,
  user,
  close,
  switchMode,
  accepted,
  verified,
}: {
  mode: AuthMode;
  token?: string;
  user: User | null;
  close: () => void;
  switchMode: (mode: AuthMode) => void;
  accepted: (user: User) => void;
  verified: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [config, setConfig] = useState<MailConfig | null>(null);
  useEffect(() => {
    void api<MailConfig>("auth/config")
      .then(setConfig)
      .catch(() => {});
  }, []);
  const title = {
    login: "账号登录",
    register: "注册游戏账号",
    forgot: "找回密码",
    reset: "设置新密码",
    verify: "验证账号邮箱",
  }[mode];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError("");
    setBusy(true);
    try {
      const password = fields.get("password");
      if (
        (mode === "register" || mode === "reset") &&
        password !== fields.get("confirm")
      )
        throw new Error("两次输入的密码不一致");
      if (mode === "login" || mode === "register") {
        const result = await api<{ user: User }>(mode, {
          name: fields.get("name"),
          password,
        });
        accepted(result.user);
      } else if (mode === "forgot") {
        const result = await api<{ message: string }>("password/forgot", {
          email: fields.get("email"),
        });
        setMessage(result.message);
      } else {
        await api(mode === "verify" ? "email/confirm" : "password/reset", {
          token,
          password,
        });
        setMessage(
          mode === "verify"
            ? "邮箱验证成功。所有设备已退出，请用昵称或邮箱重新登录。"
            : "密码已重置。所有设备已退出，请使用新密码登录。",
        );
        verified();
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const done = !!message && (mode === "verify" || mode === "reset");
  return (
    <Modal title={title} close={close}>
      <h2>{title}</h2>
      <p>
        {mode === "register"
          ? user?.guest
            ? `当前游客的 ${user.wins} 胜 ${user.losses} 负及账号身份将保留。`
            : "注册后可以保存战绩，并在账号中心绑定邮箱。"
          : mode === "forgot"
            ? "请输入已验证的绑定邮箱，我们会发送重置链接。"
            : mode === "verify"
              ? "确认绑定邮件中的邮箱。验证成功后，需要重新登录。"
              : mode === "reset"
                ? "请输入新密码。重置成功后，所有设备需要重新登录。"
                : "使用昵称或已验证的邮箱登录游戏大厅。"}
      </p>
      <form className="auth-form" onSubmit={submit}>
        <fieldset disabled={busy || done} className="account-fields">
          {(mode === "login" || mode === "register") && (
            <label>
              {mode === "register" ? "棋友昵称" : "昵称或已验证邮箱"}
              <input
                name="name"
                required
                minLength={2}
                maxLength={mode === "register" ? 16 : 254}
                autoComplete="username"
                placeholder={
                  mode === "register"
                    ? "2–16 位中文、字母、数字、_ 或 -"
                    : "昵称 / 邮箱"
                }
              />
            </label>
          )}
          {mode === "forgot" && (
            <label>
              绑定邮箱
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="name@example.com"
              />
            </label>
          )}
          {mode !== "verify" && mode !== "forgot" && (
            <PasswordField
              label={mode === "reset" ? "新密码" : "密码"}
              name="password"
              fresh={mode !== "login"}
            />
          )}
          {(mode === "register" || mode === "reset") && (
            <PasswordField label="确认密码" name="confirm" fresh />
          )}
          {!done && (
            <button
              className="primary"
              type="submit"
              disabled={mode === "forgot" && config?.mailMode === "disabled"}
            >
              {busy
                ? "处理中…"
                : {
                    login: "登录大厅",
                    register: user?.guest ? "升级并保留战绩" : "注册并进入大厅",
                    forgot: "发送重置邮件",
                    reset: "重置密码",
                    verify: "确认验证邮箱",
                  }[mode]}
            </button>
          )}
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="form-success" role="status">
            {message}
          </p>
        )}
      </form>
      {mode === "forgot" && <MailNotice config={config} />}
      <div className="auth-links">
        {mode === "login" ? (
          <>
            <button
              className="text-button"
              onClick={() => switchMode("register")}
            >
              注册账号
            </button>
            <button
              className="text-button"
              onClick={() => switchMode("forgot")}
            >
              忘记密码
            </button>
          </>
        ) : (
          <button className="text-button" onClick={() => switchMode("login")}>
            返回登录
          </button>
        )}
      </div>
    </Modal>
  );
}

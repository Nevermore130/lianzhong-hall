import { useEffect, useState, type FormEvent } from "react";
import {
  avatars,
  type AccountProfile,
  type DeviceSession,
} from "../../shared/accounts.ts";
import type { User } from "../../shared/protocol.ts";
import { api } from "../lib/client";
import { Modal } from "./Modal";
import { PlayerPortrait } from "./ClientArt";
import { MailNotice, PasswordField, type MailConfig } from "./AuthDialog";

const tabs = ["个人资料", "密码与邮箱", "登录设备", "注销账号"] as const;
const date = (value: number) =>
  new Date(value).toLocaleString("zh-CN", { hour12: false });
export function AccountCenter({
  user,
  close,
  accepted,
  deleted,
}: {
  user: User;
  close: () => void;
  accepted: (user: User) => void;
  deleted: () => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("个人资料");
  const [profile, setProfile] = useState<AccountProfile | null>(null),
    [config, setConfig] = useState<MailConfig | null>(null);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [avatar, setAvatar] = useState(user.avatar),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  async function load() {
    setError("");
    try {
      const result = await api<MailConfig & { profile: AccountProfile }>(
        "account",
      );
      setProfile(result.profile);
      setAvatar(result.profile.avatar);
      setConfig(result);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  async function loadSessions() {
    const result = await api<{ sessions: DeviceSession[] }>("sessions");
    setSessions(result.sessions);
  }
  useEffect(() => {
    void load();
  }, [user.id]);
  useEffect(() => {
    if (tab !== "登录设备") return;
    void loadSessions().catch((error: Error) => setError(error.message));
  }, [tab]);
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submit(
    event: FormEvent<HTMLFormElement>,
    action: (data: FormData) => Promise<void>,
    success: string,
    clear = false,
  ) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form);
    void run(async () => {
      await action(data);
      if (clear) form.reset();
    }, success);
  }
  return (
    <Modal title="我的账号 · 属性" close={close} wide>
      <div className="account-center">
        <div className="account-heading">
          <PlayerPortrait avatar={user.avatar} />
          <div>
            <strong>{user.name}</strong>
            <span>
              正式玩家　积分 {user.points}　{user.wins} 胜 / {user.losses} 负
            </span>
          </div>
        </div>
        <div className="account-tabs" aria-label="账号设置">
          {tabs.map((name) => (
            <button
              key={name}
              aria-pressed={tab === name}
              disabled={busy}
              onClick={() => {
                setTab(name);
                setError("");
                setMessage("");
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <section className="account-panel" aria-label={tab}>
          {!profile ? (
            <>
              <p>{error ? "账号资料加载失败。" : "正在读取账号资料…"}</p>
              {error && <button onClick={() => void load()}>重新加载</button>}
            </>
          ) : (
            <>
              {tab === "个人资料" && (
                <form
                  className="auth-form"
                  onSubmit={(event) =>
                    submit(
                      event,
                      async (data) => {
                        const result = await api<{ user: User }>("profile", {
                          name: data.get("name"),
                          avatar,
                        });
                        setProfile({ ...profile, ...result.user });
                        accepted(result.user);
                      },
                      "资料已保存，大厅中的昵称和头像已同步。",
                    )
                  }
                >
                  <fieldset disabled={busy} className="account-fields">
                    <label>
                      棋友昵称
                      <input
                        key={profile.name}
                        name="name"
                        defaultValue={profile.name}
                        required
                        minLength={2}
                        maxLength={16}
                        autoComplete="nickname"
                      />
                    </label>
                    <fieldset className="avatar-picker">
                      <legend>选择头像</legend>
                      {avatars.map((name, index) => (
                        <button
                          type="button"
                          key={name}
                          aria-label={`头像：${name}`}
                          aria-pressed={avatar === index}
                          onClick={() => setAvatar(index)}
                        >
                          <PlayerPortrait avatar={index} />
                          <span>{name}</span>
                        </button>
                      ))}
                    </fieldset>
                    <dl className="account-facts">
                      <dt>账号编号</dt>
                      <dd>{profile.id}</dd>
                      <dt>创建时间</dt>
                      <dd>{date(profile.createdAt)}</dd>
                      <dt>积分</dt>
                      <dd>{profile.points}</dd>
                      <dt>战绩</dt>
                      <dd>
                        {profile.wins} 胜 / {profile.losses} 负
                      </dd>
                    </dl>
                    <button type="submit" className="primary">
                      保存资料
                    </button>
                  </fieldset>
                </form>
              )}
              {tab === "密码与邮箱" && (
                <>
                  <fieldset className="account-group">
                    <legend>修改密码</legend>
                    <p>修改后保留本次登录，其他设备会退出。</p>
                    <form
                      className="auth-form"
                      onSubmit={(event) =>
                        submit(
                          event,
                          async (data) => {
                            if (data.get("newPassword") !== data.get("confirm"))
                              throw new Error("两次输入的新密码不一致");
                            const result = await api<{ user: User }>(
                              "password/change",
                              {
                                currentPassword: data.get("currentPassword"),
                                newPassword: data.get("newPassword"),
                              },
                            );
                            accepted(result.user);
                          },
                          "密码已修改，其他设备已退出。",
                          true,
                        )
                      }
                    >
                      <fieldset disabled={busy} className="account-fields">
                        <PasswordField
                          label="当前密码"
                          name="currentPassword"
                        />
                        <PasswordField
                          label="新密码"
                          name="newPassword"
                          fresh
                        />
                        <PasswordField
                          label="确认新密码"
                          name="confirm"
                          fresh
                        />
                        <button type="submit">修改密码</button>
                      </fieldset>
                    </form>
                  </fieldset>
                  <fieldset className="account-group">
                    <legend>绑定邮箱</legend>
                    <p>
                      当前邮箱：<strong>{profile.email ?? "尚未绑定"}</strong>
                      {profile.email && "（已验证）"}
                    </p>
                    <p>
                      验证后可用邮箱登录、找回密码。更换邮箱也需要验证，完成后所有设备重新登录。
                    </p>
                    <form
                      className="auth-form"
                      onSubmit={(event) =>
                        submit(
                          event,
                          async (data) => {
                            await api("email/request", {
                              email: data.get("email"),
                              password: data.get("password"),
                            });
                            setEmailSent(true);
                          },
                          "验证邮件已发送，请在 15 分钟内打开邮件完成验证。",
                          true,
                        )
                      }
                    >
                      <fieldset
                        disabled={busy || config?.mailMode === "disabled"}
                        className="account-fields"
                      >
                        <label>
                          {profile.email ? "新邮箱" : "邮箱地址"}
                          <input
                            name="email"
                            type="email"
                            required
                            maxLength={254}
                            autoComplete="email"
                            placeholder="name@example.com"
                          />
                        </label>
                        <PasswordField label="验证当前密码" name="password" />
                        <button type="submit">发送验证邮件</button>
                      </fieldset>
                    </form>
                    {(emailSent || config?.mailMode === "disabled") && (
                      <MailNotice config={config} />
                    )}
                  </fieldset>
                </>
              )}
              {tab === "登录设备" && (
                <>
                  <p>显示有效的登录会话。同一浏览器的标签页共享一个会话。</p>
                  <div className="session-list">
                    {sessions.map((session) => (
                      <article key={session.id} className="session-row">
                        <div>
                          <strong>{session.device}</strong>
                          {session.current && <em>当前设备</em>}
                          <small>最近活动：{date(session.lastSeenAt)}</small>
                          <small>登录时间：{date(session.createdAt)}</small>
                        </div>
                        {!session.current && (
                          <button
                            disabled={busy}
                            aria-label={`退出 ${session.device}`}
                            onClick={() =>
                              void run(async () => {
                                await api("sessions/revoke", {
                                  sessionId: session.id,
                                });
                                await loadSessions();
                              }, "该设备已退出登录。")
                            }
                          >
                            退出设备
                          </button>
                        )}
                      </article>
                    ))}
                    {!sessions.length && <p>暂无会话记录，请刷新列表。</p>}
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => void run(loadSessions, "设备列表已更新。")}
                  >
                    刷新列表
                  </button>
                  <form
                    className="auth-form"
                    onSubmit={(event) =>
                      submit(
                        event,
                        async (data) => {
                          await api("sessions/revoke-others", {
                            password: data.get("password"),
                          });
                          await loadSessions();
                        },
                        "其他设备已全部退出，当前设备保持登录。",
                        true,
                      )
                    }
                  >
                    <fieldset
                      className="account-fields"
                      disabled={
                        busy ||
                        sessions.filter((session) => !session.current)
                          .length === 0
                      }
                    >
                      <PasswordField
                        label="当前密码（退出其他设备）"
                        name="password"
                      />
                      <button type="submit">退出其他所有设备</button>
                    </fieldset>
                  </form>
                  <p className="account-footnote">
                    使用期间自动续期；连续 7 天未续期或登录满 30
                    天后，需要重新登录。
                  </p>
                </>
              )}
              {tab === "注销账号" && (
                <>
                  <div className="deletion-notice">
                    <strong>注销后无法恢复</strong>
                    <p>
                      昵称、头像、绑定邮箱、密码和个人战绩将被删除，所有设备会退出。已完成对局中的身份会匿名化，对手战绩保留。
                    </p>
                    <p>请先结束当前对局，再输入当前昵称和密码确认注销。</p>
                  </div>
                  <form
                    className="auth-form"
                    onSubmit={(event) =>
                      submit(
                        event,
                        async (data) => {
                          await api("account/delete", {
                            confirmation: data.get("confirmation"),
                            password: data.get("password"),
                          });
                          deleted();
                        },
                        "",
                      )
                    }
                  >
                    <fieldset disabled={busy} className="account-fields">
                      <label>
                        输入当前昵称以确认
                        <input
                          name="confirmation"
                          required
                          autoComplete="off"
                          placeholder={profile.name}
                        />
                      </label>
                      <PasswordField label="注销验证密码" name="password" />
                      <label className="confirm-delete">
                        <input type="checkbox" required />
                        我了解账号注销后无法恢复
                      </label>
                      <button type="submit" className="danger-button">
                        永久注销此账号
                      </button>
                    </fieldset>
                  </form>
                </>
              )}
            </>
          )}
          {busy && (
            <p role="status" className="account-feedback">
              正在处理，请稍候…
            </p>
          )}
          {error && (
            <p className="form-error account-feedback" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-success account-feedback" role="status">
              {message}
            </p>
          )}
        </section>
        <div className="dialog-actions">
          <button onClick={close}>关闭</button>
        </div>
      </div>
    </Modal>
  );
}

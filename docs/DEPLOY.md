# 生产部署指南

本指南适用于在单台 VPS 上部署众乐游戏大厅，基于香港腾讯云轻量服务器的真实生产环境编写。

## 架构说明

### 技术栈
- **前端**: Vite + React 静态构建，通过反向代理提供服务
- **后端**: Node.js 24+ / tsx，单进程运行在 `127.0.0.1:3088`
- **数据库**: SQLite，存储账号、会话、战绩和聊天记录
- **通信**: HTTP API + WebSocket (`/ws` 路径)
- **反向代理**: Caddy (端口 80/443 → 3088)
- **进程管理**: systemd
- **备份**: cron 定时备份 SQLite

### 单进程限制

⚠️ **重要**: 本应用使用 SQLite 并在内存中维护实时房间状态，**不支持多实例部署**。

- ✅ 支持单 VPS、单进程运行
- ✅ 支持单机多线程并发（Node.js 异步 I/O）
- ❌ 不支持多节点、负载均衡或 Kubernetes
- ❌ 服务重启会清空内存中的自建房间和进行中的对局（默认桌会重建，账号和历史战绩不受影响）

扩展方案：将房间状态持久化到数据库或 Redis 后才可支持多实例部署，当前版本尚未实现。

### 安装路径

**生产环境**使用 `/var/www/lianzhong-hall` 作为部署路径，与 Caddyfile 模板保持一致。

部署脚本默认使用 `/opt/lianzhong-hall`。如需使用生产路径，可通过环境变量覆盖：

```bash
INSTALL_DIR=/var/www/lianzhong-hall sudo bash deploy/install.sh
```

**注意**：
- `deploy/Caddyfile.https` 和 `deploy/Caddyfile.http` 中的 `root *` 路径默认为 `/var/www/lianzhong-hall`
- 如使用其他路径，需同步修改 Caddyfile 和 systemd 服务配置中的路径
- 本文档示例路径统一使用 `/opt/lianzhong-hall` 便于演示，实际部署时请替换为你的实际路径

## 推荐部署环境

### 服务器配置
- **区域**: 香港或新加坡 VPS（低延迟，海外域名免备案）
- **操作系统**: Ubuntu 24.04 LTS
- **配置**: 2核2G 起步，根据并发量调整
- **端口**: 需开放 22 (SSH), 80 (HTTP), 443 (HTTPS)
- **存储**: 至少 10GB，建议预留日志和备份空间

### 域名与 CDN
- **域名**: 推荐海外注册商（如 Cloudflare, Namecheap）托管海外服务器，无需 ICP 备案
- **DNS**: 建议使用 Cloudflare DNS，A 记录指向服务器 IP
- **CDN 代理**: 
  - ⚠️ **初期建议灰色云朵（仅 DNS）**，不启用 Cloudflare 橙色云（CDN 代理）
  - 原因: WebSocket 穿透需要额外配置，橙色云可能导致连接问题
  - 确认 WebSocket 稳定后可启用橙色云以获得 DDoS 防护和加速

### 安全注意事项
- 腾讯云扫码安全登录必须关闭（阻止自动化 SSH 连接），建议改用 SSH 密钥认证
- 后端端口 3088 必须只监听 `127.0.0.1`（localhost），不得对外暴露
- 生产环境 `MAIL_MODE` 默认为 `disabled`，配置真实 SMTP 前不发送邮件
- 设置防火墙 (ufw) 只开放必要端口

## 首次部署

### 前置要求
- 具有 sudo 权限的 SSH 访问
- Git 已安装
- 准备好公网 IP 或已解析的域名

### 1. 准备服务器

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y git curl sqlite3

# 关闭腾讯云扫码登录（如适用）
# 在腾讯云控制台 -> 轻量应用服务器 -> 安全 -> 关闭"扫码安全登录"
# 配置 SSH 密钥认证（推荐）
```

### 2. 安装 Node.js 24+

```bash
# 使用 NodeSource 官方仓库
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证版本
node -v  # 应显示 v24.x.x 或更高
npm -v
```

### 3. 克隆代码库

```bash
# 克隆到 /opt 目录（需要 sudo）
sudo mkdir -p /opt
cd /opt
sudo git clone <你的代码库 URL> lianzhong-hall
sudo chown -R ubuntu:ubuntu lianzhong-hall

# 进入项目目录
cd lianzhong-hall
```

### 4. 安装依赖并构建

```bash
npm ci
npm run build

# 验证构建产物
ls -lh dist/
```

### 5. 配置环境变量

**推荐方式**: 创建 `/opt/lianzhong-hall/.env` 文件（或 `$INSTALL_DIR/.env`）配置所有环境变量。

```bash
# 创建 .env 文件
sudo nano /opt/lianzhong-hall/.env
```

示例配置：

```bash
NODE_ENV=production
APP_ORIGIN=http://203.0.113.10
MAIL_MODE=disabled

# 启用 SMTP 时配置:
# MAIL_MODE=smtp
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_FROM=Game Hall <noreply@example.com>
# SMTP_USER=your-email@example.com
# SMTP_PASSWORD=your-password
```

| 变量                    | 必填 | 说明                                                                                      | 示例值                          |
| ----------------------- | ---- | ----------------------------------------------------------------------------------------- | ------------------------------- |
| `NODE_ENV`              | 是   | 设置为 `production`                                                                       | `production`                    |
| `APP_ORIGIN`            | 是   | **浏览器访问的完整 Origin**，用于同源检查和邮件链接。HTTPS 时必须为 https，否则 http     | `https://yourdomain.com` 或 `http://203.0.113.10` |
| `MAIL_MODE`             | 否   | 邮件模式：`disabled`(默认) / `smtp` / `local`(仅开发)                                     | `disabled` 或 `smtp`            |
| `PORT`                  | 否   | 后端监听端口                                                                              | `3088` (默认)                   |
| `HOST`                  | 否   | 监听地址，必须为 `127.0.0.1`                                                              | `127.0.0.1` (默认)              |
| `DATABASE_PATH`         | 否   | SQLite 文件路径                                                                           | `data/hall.sqlite` (默认)       |
| `SMTP_HOST`             | SMTP | SMTP 服务器地址                                                                           | `smtp.gmail.com`                |
| `SMTP_PORT`             | SMTP | SMTP 端口（465=TLS, 587/其他=STARTTLS）                                                   | `587`                           |
| `SMTP_FROM`             | SMTP | 发件人地址                                                                                | `Game Hall <noreply@example.com>` |
| `SMTP_USER`             | SMTP | SMTP 用户名                                                                               | `your-email@example.com`        |
| `SMTP_PASSWORD`         | SMTP | SMTP 密码                                                                                 | `your-app-password`             |

**关键配置说明**:
- `.env` 为配置源，优先级高于 systemd 服务文件中的默认值
- `APP_ORIGIN` 必须与浏览器实际访问地址的协议、域名/IP、端口完全一致
- HTTPS 环境必须设置 `APP_ORIGIN=https://...`，此时会话 Cookie 自动添加 `Secure` 标志
- HTTP 环境（如纯 IP 访问）必须设置 `APP_ORIGIN=http://...`，不会设置 `Secure`，WebSocket 才能正常工作
- 生产环境默认 `MAIL_MODE=disabled`，未配置 SMTP 时绑定邮箱功能不可用
- **不要在 systemd 服务文件中设置 `APP_ORIGIN`**，systemd 的 `Environment=` 会覆盖 `.env` 中的配置

### 6. 安装 Caddy

```bash
# 安装 Caddy（官方脚本）
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# 验证安装
caddy version
```

### 7. 配置 Caddy 反向代理

⚠️ **生产环境推荐使用 HTTPS 模式**。HTTP 模式仅用于 DNS 配置前的临时测试。

#### HTTPS 模式（推荐，生产环境）

适用于已解析域名，Caddy 自动申请 Let's Encrypt 证书。

**前置条件**:
1. 域名 DNS A 记录已指向服务器 IP（可用 `dig yourdomain.com` 验证）
2. 端口 80 和 443 必须对外开放（Let's Encrypt 验证需要）
3. 服务器未被墙（Let's Encrypt ACME 挑战需要从外网访问）

**配置步骤**:

```bash
# 1. 复制生产环境 HTTPS 配置模板
sudo cp /opt/lianzhong-hall/deploy/Caddyfile.https /etc/caddy/Caddyfile

# 2. 编辑配置，修改域名和邮箱
sudo nano /etc/caddy/Caddyfile
```

需要修改的内容：
- 第 2 行：`email admin@zhongle.online` 改为你的管理邮箱（用于 Let's Encrypt 续期通知）
- 最后一行：`zhongle.online, www.zhongle.online` 改为你的域名（支持多个域名用逗号分隔）
- 如果安装路径不是 `/var/www/lianzhong-hall`，需修改 `root *` 路径

```bash
# 3. 重启 Caddy（首次会自动申请证书）
sudo systemctl reload caddy

# 4. 检查日志确认证书申请成功
sudo journalctl -u caddy -f
```

在 `.env` 中设置：
```bash
APP_ORIGIN=https://yourdomain.com  # 必须是 https，与 Caddyfile 中的主域名一致
```

Caddy 会自动续期证书，无需手动干预。

#### HTTP 模式（临时测试用，不推荐生产）

⚠️ **仅用于 DNS 配置前的临时测试**，无加密，不适合生产环境。

```bash
# 复制 HTTP 配置模板
sudo cp /opt/lianzhong-hall/deploy/Caddyfile.http /etc/caddy/Caddyfile

# 如需修改路径，编辑配置
sudo nano /etc/caddy/Caddyfile

# 重启 Caddy
sudo systemctl reload caddy
```

在 `.env` 中设置：
```bash
APP_ORIGIN=http://203.0.113.10  # 替换为你的服务器 IP
```

**配置好 DNS 后应立即切换到 HTTPS 模式。**

### 8. 配置 systemd 服务

```bash
# 复制服务单元模板
sudo cp /opt/lianzhong-hall/deploy/lianzhong-hall.service /etc/systemd/system/

# 编辑服务配置，设置正确的 APP_ORIGIN 和其他环境变量
sudo nano /etc/systemd/system/lianzhong-hall.service

# 关键修改：
# - APP_ORIGIN=http://YOUR_IP_OR_DOMAIN_HERE  改为实际地址
# - MAIL_MODE 根据需要设置为 disabled 或 smtp
# - 如使用 SMTP，取消注释 SMTP_* 变量并填入真实值

# 重载 systemd 配置
sudo systemctl daemon-reload

# 启动并设置开机自启
sudo systemctl enable lianzhong-hall
sudo systemctl start lianzhong-hall

# 检查状态
sudo systemctl status lianzhong-hall
```

### 9. 配置防火墙

```bash
# 使用 ufw 配置防火墙
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# 确认规则
sudo ufw status
```

⚠️ 不要开放 3088 端口，后端仅监听 localhost。

### 10. 配置自动备份

```bash
# 创建备份目录
sudo mkdir -p /opt/lianzhong-backups
sudo chown ubuntu:ubuntu /opt/lianzhong-backups

# 添加每日备份 cron 任务（凌晨 3 点）
crontab -e
# 添加以下行：
0 3 * * * sqlite3 /opt/lianzhong-hall/data/hall.sqlite ".backup /opt/lianzhong-backups/hall-$(date +\%Y\%m\%d).sqlite" && find /opt/lianzhong-backups -name 'hall-*.sqlite' -mtime +30 -delete
```

备份策略：每日备份，保留 30 天。

### 11. 验证部署

```bash
# 检查服务状态
sudo systemctl status lianzhong-hall
sudo systemctl status caddy

# 查看实时日志
sudo journalctl -u lianzhong-hall -f

# 本地健康检查
curl http://127.0.0.1:3088/api/health

# 浏览器访问测试
# HTTP: http://203.0.113.10
# HTTPS: https://yourdomain.com
```

测试要点：
- 页面正常加载
- 游客身份进入大厅
- 能看到在线人数
- 大厅聊天发送成功
- 进入游戏房间，WebSocket 连接正常（查看浏览器控制台无错误）

## 发布更新

### 更新流程

⚠️ **重要**: 服务重启会断开所有在线玩家并清空内存中的房间，建议在低峰期进行。

```bash
# 切换到项目目录
cd /opt/lianzhong-hall

# 方式 1: 使用自动化脚本（推荐）
bash deploy/release.sh

# 方式 2: 手动更新
git fetch origin
git pull origin main  # 或你的生产分支
npm ci
npm run build
sudo systemctl restart lianzhong-hall

# 检查服务状态
sudo systemctl status lianzhong-hall

# 查看启动日志
sudo journalctl -u lianzhong-hall -n 100
```

### 回滚版本

```bash
cd /opt/lianzhong-hall

# 查看历史版本
git log --oneline -10

# 回滚到指定 commit
git checkout <commit-sha>
npm ci
npm run build
sudo systemctl restart lianzhong-hall
```

### 零停机发布（高级）

当前单进程架构不支持真正的零停机部署。可选方案：

1. **维护通知**: 提前在大厅聊天发布公告，计划停机窗口
2. **快速重启**: 优化构建和启动时间，将停机时间缩短到 5-10 秒
3. **未来改进**: 实现房间状态持久化后，可支持多实例 + 滚动更新

## 备份与恢复

### 手动备份

```bash
# 备份数据库
cd /opt/lianzhong-hall
sqlite3 data/hall.sqlite ".backup data/hall-backup-$(date +%Y%m%d-%H%M%S).sqlite"

# 备份整个应用（不包括 node_modules）
tar -czf ~/lianzhong-backup-$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  /opt/lianzhong-hall
```

### 恢复数据库

```bash
# 停止服务
sudo systemctl stop lianzhong-hall

# 恢复备份（替换当前数据库）
cp /opt/lianzhong-backups/hall-20260918.sqlite /opt/lianzhong-hall/data/hall.sqlite

# 启动服务
sudo systemctl start lianzhong-hall
```

### 迁移到新服务器

```bash
# 旧服务器：备份
cd /opt/lianzhong-hall
sqlite3 data/hall.sqlite ".backup /tmp/hall-migration.sqlite"
scp /tmp/hall-migration.sqlite newserver:/tmp/

# 新服务器：按"首次部署"流程完成 1-8 步
# 新服务器：停止服务并恢复数据
sudo systemctl stop lianzhong-hall
cp /tmp/hall-migration.sqlite /opt/lianzhong-hall/data/hall.sqlite
sudo chown ubuntu:ubuntu /opt/lianzhong-hall/data/hall.sqlite
sudo systemctl start lianzhong-hall

# 更新 DNS 指向新服务器 IP
```

## 健康检查与监控

### 基础健康检查

```bash
# 接口健康检查（返回 {"ok":true}）
curl http://127.0.0.1:3088/api/health

# WebSocket 快速测试（使用浏览器开发者工具）
# 1. 打开浏览器访问站点
# 2. F12 -> Console
# 3. 观察是否有 WebSocket 连接错误
```

### 日志监控

```bash
# 查看实时日志
sudo journalctl -u lianzhong-hall -f

# 查看最近 100 条日志
sudo journalctl -u lianzhong-hall -n 100

# 查看今天的错误日志
sudo journalctl -u lianzhong-hall --since today --priority err

# Caddy 日志
sudo journalctl -u caddy -f
```

### 性能监控（可选）

```bash
# 查看系统资源
htop

# 查看 Node.js 进程
ps aux | grep node

# 查看数据库大小
ls -lh /opt/lianzhong-hall/data/hall.sqlite
du -sh /opt/lianzhong-hall/data/
```

## 安全检查清单

部署完成后，确认以下安全措施：

- [ ] 后端端口 3088 只监听 `127.0.0.1`，未对外暴露
- [ ] HTTPS 环境下 `APP_ORIGIN` 设置为 `https://`，Secure cookie 已启用
- [ ] HTTP 临时环境 `APP_ORIGIN` 设置为 `http://`，确保 WebSocket 能连接
- [ ] 防火墙只开放 22、80、443 端口
- [ ] SSH 密钥认证已配置，腾讯云扫码登录已关闭（如适用）
- [ ] 数据库文件权限正确（`chown ubuntu:ubuntu data/hall.sqlite`）
- [ ] 每日备份 cron 任务已配置并测试
- [ ] 生产环境不使用 `MAIL_MODE=local`（本地收件箱）
- [ ] SMTP 密码等敏感信息不提交到 Git 仓库
- [ ] Caddy HSTS header 已启用（仅 HTTPS 模式）
- [ ] 定期更新系统和 Node.js 依赖（安全补丁）

## 故障排查

### WebSocket 401 未授权错误

**症状**: 浏览器控制台显示 WebSocket 连接失败 401。

**原因**: Secure cookie 设置不当。
- HTTPS 环境下，如果 `APP_ORIGIN` 误设为 `http://`，cookie 没有 Secure 标志，导致浏览器拒绝在 HTTPS 下发送
- HTTP 环境下，如果 `APP_ORIGIN` 误设为 `https://` 或 NODE_ENV=production 但实际是 HTTP，cookie 有 Secure 标志，浏览器拒绝在 HTTP 下发送

**解决方案**:
1. 确认 `APP_ORIGIN` 与浏览器访问地址的协议一致
2. HTTP 临时部署：`APP_ORIGIN=http://YOUR.SERVER.IP`
3. HTTPS 正式部署：`APP_ORIGIN=https://yourdomain.com`
4. 修改后重启服务：`sudo systemctl restart lianzhong-hall`
5. 清除浏览器 Cookie 后重新登录

### 扫码安全登录阻止 SSH

**症状**: SSH 连接后需要手机扫码确认，自动化脚本失败。

**解决方案**:
1. 在腾讯云控制台 -> 轻量应用服务器 -> 安全设置
2. 关闭"扫码安全登录"功能
3. 改用 SSH 密钥认证（更安全且自动化友好）

### Origin 不匹配 403 错误

**症状**: API 请求返回 403 "请求来源不正确"。

**原因**: 
- `APP_ORIGIN` 与浏览器 `window.location.origin` 不一致
- 端口不匹配（如 APP_ORIGIN 未包含端口但浏览器访问带端口）
- 协议不匹配（http vs https）

**解决方案**:
1. 检查浏览器地址栏完整 URL
2. 在开发者工具 Console 执行 `window.location.origin`
3. 将该值完整设置到 `APP_ORIGIN` 环境变量
4. 重启服务

### 服务无法启动

```bash
# 查看详细错误日志
sudo journalctl -u lianzhong-hall -n 50

# 常见问题：
# - 端口 3088 被占用：sudo lsof -i :3088
# - Node 版本过低：node -v 应为 24+
# - 文件权限问题：sudo chown -R ubuntu:ubuntu /opt/lianzhong-hall
# - 数据库文件损坏：尝试恢复备份
```

### Caddy HTTPS 证书申请失败

```bash
# 查看 Caddy 日志
sudo journalctl -u caddy -n 100

# 常见原因：
# - DNS 未正确解析：dig yourdomain.com
# - 端口 80 未开放（Let's Encrypt 验证需要）
# - 服务器被墙，无法访问 Let's Encrypt ACME 服务器
# - 域名已被其他证书占用（速率限制）

# 临时回退到 HTTP 模式：
sudo cp /opt/lianzhong-hall/deploy/Caddyfile.http /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 数据库锁定错误

**症状**: 日志显示 "database is locked"。

**解决方案**:
1. SQLite 不支持高并发写入，检查是否有外部脚本并发访问数据库
2. 确保备份脚本使用 `.backup` 命令而非 `cp`（`.backup` 是在线备份）
3. 停止服务后手动检查数据库完整性：
   ```bash
   sudo systemctl stop lianzhong-hall
   sqlite3 /opt/lianzhong-hall/data/hall.sqlite "PRAGMA integrity_check;"
   sudo systemctl start lianzhong-hall
   ```

## 性能优化建议

1. **数据库优化**
   - 定期执行 `VACUUM` 收缩数据库：
     ```bash
     sudo systemctl stop lianzhong-hall
     sqlite3 /opt/lianzhong-hall/data/hall.sqlite "VACUUM;"
     sudo systemctl start lianzhong-hall
     ```
   - 考虑定期归档旧聊天记录（保留最近 30 天）

2. **Caddy 优化**
   - 已启用 GZIP 压缩
   - 可配置静态文件缓存（已构建在 dist/）

3. **服务器优化**
   - 配置 swap（建议 2G 内存 + 2G swap）
   - 监控磁盘空间（日志和备份会增长）
   - 考虑升级配置（4核4G）支持更多并发

4. **CDN 加速**（可选）
   - Cloudflare 橙色云代理（需确认 WebSocket 支持）
   - 或将静态资源上传到 CDN，修改 Vite 配置

## 进一步参考

- 架构文档：[docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- 接口协议：[docs/PROTOCOL.md](./PROTOCOL.md)
- 问题排查：[docs/QA.md](./QA.md)
- 本地开发：[README.md](../README.md)

## 支持与反馈

遇到问题时：
1. 先查看日志：`sudo journalctl -u lianzhong-hall -n 100`
2. 参考上述"故障排查"章节
3. 确认环境变量配置正确（特别是 `APP_ORIGIN`）
4. 检查防火墙和网络连接
5. 提交 Issue 时请附上错误日志和环境信息（隐去敏感信息）

# 部署配置文件说明

本目录包含众乐游戏大厅的生产部署配置文件和脚本。

## Caddy 配置文件

### Caddyfile.https（推荐用于生产环境）

**用途**: 生产环境 HTTPS 配置，使用 Let's Encrypt 自动证书

**功能**:
- 自动 HTTPS / Let's Encrypt 证书申请和续期
- 支持多域名（如 `zhongle.online` 和 `www.zhongle.online`）
- gzip + zstd 压缩
- `/assets/*` 资源缓存（immutable，1年）
- `/favicon.svg` 缓存（1天）
- 反向代理到后端 `127.0.0.1:3088`

**前置条件**:
- DNS A/AAAA 记录已指向服务器 IP
- 端口 80/443 已开放
- 配置管理员邮箱（用于证书续期通知）

**使用方法**:
```bash
sudo cp deploy/Caddyfile.https /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile  # 修改域名和邮箱
sudo systemctl reload caddy
```

### Caddyfile.http（临时测试用）

**用途**: DNS 配置前的临时 HTTP 测试

**限制**:
- ⚠️ 无加密，不适合生产环境
- 凭据和游戏数据明文传输
- 需要在 `.env` 中设置 `APP_ORIGIN=http://YOUR.SERVER.IP`

**使用场景**: 仅用于域名 DNS 配置之前的初步功能验证

**使用方法**:
```bash
sudo cp deploy/Caddyfile.http /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**配置好 DNS 后应立即切换到 HTTPS 模式。**

## 部署脚本

### install.sh

首次安装脚本，执行:
- 安装 Node.js 24+ 和 Caddy
- 克隆仓库到指定目录（默认 `/opt/lianzhong-hall`）
- 构建应用
- 配置 systemd 服务
- 设置每日数据库备份

**使用方法**:
```bash
sudo bash deploy/install.sh [REPO_URL] [APP_ORIGIN]
```

**自定义安装路径**:
```bash
INSTALL_DIR=/var/www/lianzhong-hall sudo bash deploy/install.sh
```

### release.sh

更新已部署应用的脚本，执行:
- 拉取最新代码
- 安装依赖
- 重新构建
- 重启服务

**使用方法**:
```bash
cd /opt/lianzhong-hall  # 或你的实际安装路径
bash deploy/release.sh [git-ref]
```

⚠️ 重启会断开所有在线玩家并清空内存中的房间，建议在低峰期执行。

### lianzhong-hall.service

systemd 服务单元文件，定义应用的启动方式和环境变量。

**使用方法**:
```bash
sudo cp deploy/lianzhong-hall.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable lianzhong-hall
sudo systemctl start lianzhong-hall
```

## 生产环境配置参考

**当前生产环境（zhongle.online）使用配置**:
- 路径: `/var/www/lianzhong-hall`
- 域名: `zhongle.online`, `www.zhongle.online`
- Caddy 自动 HTTPS（Let's Encrypt）
- 管理邮箱: `admin@zhongle.online`
- DNS: 灰云模式（DNS only），未启用 CDN 代理

## 更多信息

详细部署步骤请参考 [docs/DEPLOY.md](../docs/DEPLOY.md)

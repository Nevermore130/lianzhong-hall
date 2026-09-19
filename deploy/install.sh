#!/bin/bash
set -euo pipefail

# Lianzhong Hall - Initial Installation Script
# Usage: sudo bash install.sh [REPO_URL] [APP_ORIGIN]
#
# Arguments:
#   REPO_URL    - Git repository URL (default: https://github.com/Nevermore130/lianzhong-hall.git)
#   APP_ORIGIN  - Browser-facing origin for cookies (default: http://YOUR.SERVER.IP)
#
# This script performs first-time setup:
# - Installs Node.js 24+ if not present
# - Clones the repository to /opt/lianzhong-hall (or $INSTALL_DIR if set)
# - Installs dependencies and builds the app
# - Sets up systemd service
# - Installs Caddy and documents next steps
# - Configures daily backup cron job
#
# Examples:
#   sudo bash install.sh
#   sudo bash install.sh https://github.com/yourusername/lianzhong-hall.git http://203.0.113.10
#   INSTALL_DIR=/var/www/lianzhong-hall sudo bash install.sh

if [ "$EUID" -ne 0 ]; then
  echo "错误: 请使用 sudo 运行此脚本"
  exit 1
fi

REPO_URL="${1:-https://github.com/Nevermore130/lianzhong-hall.git}"
APP_ORIGIN="${2:-}"
INSTALL_DIR="${INSTALL_DIR:-/opt/lianzhong-hall}"
SERVICE_USER="ubuntu"

echo "==> 联众游戏大厅 - 首次安装"

# Check Node.js version
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
  if [ "$NODE_VERSION" -ge 24 ]; then
    echo "✓ Node.js $(node -v) 已安装"
  else
    echo "! Node.js 版本过低 (当前 $(node -v), 需要 24+)"
    echo "请手动升级 Node.js 或运行以下命令安装 Node.js 24:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
  fi
else
  echo "==> 安装 Node.js 24..."
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
  echo "✓ Node.js $(node -v) 安装完成"
fi

# Install Caddy if not present
if ! command -v caddy &> /dev/null; then
  echo "==> 安装 Caddy..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
  echo "✓ Caddy 安装完成"
else
  echo "✓ Caddy 已安装"
fi

# Clone repository
if [ -d "$INSTALL_DIR" ]; then
  echo "! 目录 $INSTALL_DIR 已存在"
  echo "如需全新安装，请先删除该目录: sudo rm -rf $INSTALL_DIR"
  exit 1
fi

echo "==> 克隆代码库到 $INSTALL_DIR..."
echo "仓库地址: $REPO_URL"
git clone "$REPO_URL" "$INSTALL_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
echo "✓ 代码库克隆完成"

echo "==> 安装依赖并构建..."
cd "$INSTALL_DIR"
sudo -u "$SERVICE_USER" npm ci
sudo -u "$SERVICE_USER" npm run build
echo "✓ 构建完成"

# Create data directory
mkdir -p "$INSTALL_DIR/data"
chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/data"

# Create .env with APP_ORIGIN if provided
if [ -n "$APP_ORIGIN" ]; then
  echo "==> 创建 .env 配置..."
  cat > "$INSTALL_DIR/.env" <<EOF
# 生产环境配置
NODE_ENV=production
APP_ORIGIN=$APP_ORIGIN
MAIL_MODE=disabled

# 如需启用 SMTP 邮件，取消注释并配置:
# MAIL_MODE=smtp
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_FROM=Game Hall <noreply@example.com>
# SMTP_USER=your-email@example.com
# SMTP_PASSWORD=your-password
EOF
  chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/.env"
  echo "✓ 已创建 .env 并设置 APP_ORIGIN=$APP_ORIGIN"
else
  echo "⚠ 未提供 APP_ORIGIN，请创建 $INSTALL_DIR/.env 并设置 APP_ORIGIN"
fi

# Install systemd service
echo "==> 安装 systemd 服务..."
if [ -f "$INSTALL_DIR/deploy/lianzhong-hall.service" ]; then
  cp "$INSTALL_DIR/deploy/lianzhong-hall.service" /etc/systemd/system/
  
  # Adjust paths if INSTALL_DIR is not /opt/lianzhong-hall
  if [ "$INSTALL_DIR" != "/opt/lianzhong-hall" ]; then
    sed -i "s|WorkingDirectory=/opt/lianzhong-hall|WorkingDirectory=$INSTALL_DIR|" /etc/systemd/system/lianzhong-hall.service
    sed -i "s|EnvironmentFile=-/opt/lianzhong-hall/.env|EnvironmentFile=-$INSTALL_DIR/.env|" /etc/systemd/system/lianzhong-hall.service
    echo "✓ 已调整 systemd 服务路径为 $INSTALL_DIR"
  fi
  
  systemctl daemon-reload
  systemctl enable lianzhong-hall
  echo "✓ systemd 服务已安装并设置为开机启动"
else
  echo "! 未找到 systemd 服务模板"
  exit 1
fi

# Caddy configuration
echo ""
echo "==> 配置 Caddy"
# Create Caddy log directory
mkdir -p /var/log/caddy
chown caddy:caddy /var/log/caddy
echo "请选择配置模式:"
echo "  HTTP (IP访问):  sudo cp $INSTALL_DIR/deploy/Caddyfile.http /etc/caddy/Caddyfile"
echo "  HTTPS (域名):   sudo cp $INSTALL_DIR/deploy/Caddyfile.https /etc/caddy/Caddyfile"
echo ""
echo "然后编辑 /etc/caddy/Caddyfile 替换占位符，并重启 Caddy:"
echo "  sudo systemctl reload caddy"

# Create backup directory
mkdir -p /opt/lianzhong-backups
chown "$SERVICE_USER:$SERVICE_USER" /opt/lianzhong-backups

# Install backup cron job
CRON_JOB="0 3 * * * sqlite3 $INSTALL_DIR/data/hall.sqlite \".backup /opt/lianzhong-backups/hall-\$(date +\\%Y\\%m\\%d).sqlite\" && find /opt/lianzhong-backups -name 'hall-*.sqlite' -mtime +30 -delete"
(sudo -u "$SERVICE_USER" crontab -l 2>/dev/null || true; echo "$CRON_JOB") | sudo -u "$SERVICE_USER" crontab -
echo "✓ 每日备份任务已配置 (凌晨3点，保留30天)"

echo ""
echo "==> 安装完成！"
echo ""
echo "后续步骤:"
if [ -z "$APP_ORIGIN" ]; then
  echo "1. 创建 $INSTALL_DIR/.env 并设置 APP_ORIGIN（必须）"
fi
echo "2. 选择并配置 Caddyfile (HTTP 或 HTTPS)"
echo "3. 配置防火墙: sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable"
echo "4. 启动服务: sudo systemctl start lianzhong-hall"
echo "5. 检查状态: sudo systemctl status lianzhong-hall"
echo "6. 查看日志: sudo journalctl -u lianzhong-hall -f"

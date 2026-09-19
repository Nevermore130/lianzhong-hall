#!/bin/bash
set -euo pipefail

# Lianzhong Hall - Release/Update Script
# Usage: sudo -u ubuntu bash release.sh [git-ref]
#
# This script performs rolling updates:
# - Pulls latest code (or checks out specific git ref)
# - Installs dependencies
# - Builds the application
# - Restarts the systemd service
#
# WARNING: Restart will disconnect all active players and clear in-memory rooms.
# Plan updates during low-traffic periods.
#
# Example: sudo -u ubuntu bash release.sh
# Example: sudo -u ubuntu bash release.sh v1.2.3

INSTALL_DIR="/opt/lianzhong-hall"
GIT_REF="${1:-}"

if [ ! -d "$INSTALL_DIR" ]; then
  echo "错误: 未找到安装目录 $INSTALL_DIR"
  echo "请先运行 install.sh 进行初始安装"
  exit 1
fi

cd "$INSTALL_DIR"

echo "==> 联众游戏大厅 - 发布更新"

# Verify we're in a git repository
if [ ! -d .git ]; then
  echo "错误: $INSTALL_DIR 不是 git 仓库"
  exit 1
fi

# Stash any local changes (backup configs)
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "⚠ 检测到本地修改，暂存中..."
  git stash push -m "Auto-stash before release $(date +%Y%m%d-%H%M%S)"
fi

# Fetch and update
echo "==> 拉取最新代码..."
git fetch origin

if [ -n "$GIT_REF" ]; then
  echo "==> 检出版本: $GIT_REF"
  git checkout "$GIT_REF"
else
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  echo "==> 更新分支: $CURRENT_BRANCH"
  git pull origin "$CURRENT_BRANCH"
fi

COMMIT_SHA=$(git rev-parse --short HEAD)
echo "✓ 当前版本: $COMMIT_SHA"

# Install dependencies
echo "==> 安装依赖..."
npm ci

# Run build
echo "==> 构建应用..."
npm run build
echo "✓ 构建完成"

# Optional: run tests (comment out if tests take too long)
# echo "==> 运行测试..."
# npm test
# echo "✓ 测试通过"

# Restart service
echo "==> 重启服务..."
sudo systemctl restart lianzhong-hall

# Wait for service to be active
sleep 3
if systemctl is-active --quiet lianzhong-hall; then
  echo "✓ 服务启动成功"
else
  echo "✗ 服务启动失败，查看日志:"
  sudo journalctl -u lianzhong-hall -n 50 --no-pager
  exit 1
fi

# Health check (basic)
sleep 2
if curl -sf http://127.0.0.1:3088/api/auth/config > /dev/null; then
  echo "✓ 健康检查通过"
else
  echo "⚠ 健康检查失败，请检查服务状态"
  sudo systemctl status lianzhong-hall
  exit 1
fi

echo ""
echo "==> 发布完成！"
echo "版本: $COMMIT_SHA"
echo ""
echo "检查命令:"
echo "  状态: sudo systemctl status lianzhong-hall"
echo "  日志: sudo journalctl -u lianzhong-hall -f"
echo ""
echo "⚠ 注意: 重启已清空内存中的房间和对局，在线玩家需要重新进入"

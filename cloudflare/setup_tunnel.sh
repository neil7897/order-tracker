#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SUBDOMAIN="orders.fuchang-erp.com"
TUNNEL_NAME="order-tracker"

echo "=== Cloudflare Tunnel 設定 ==="
echo ""

# 安裝 cloudflared
if ! command -v cloudflared &>/dev/null; then
    echo "安裝 cloudflared..."
    brew install cloudflared
fi

# 登入 Cloudflare（會開瀏覽器）
echo "登入 Cloudflare（瀏覽器會自動開啟）..."
cloudflared tunnel login

# 建立 Tunnel
echo "建立 Tunnel：$TUNNEL_NAME ..."
cloudflared tunnel create $TUNNEL_NAME

# 取得 Tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}')
USERNAME=$(whoami)

# 更新 config.yml
CONFIG_PATH="$HOME/.cloudflared/config.yml"
cat > "$CONFIG_PATH" <<EOF
tunnel: $TUNNEL_ID
credentials-file: /Users/$USERNAME/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $SUBDOMAIN
    service: http://localhost:8000
  - service: http_status:404
EOF

echo "設定檔已寫入：$CONFIG_PATH"

# 設定 DNS（自動在 Cloudflare 建 CNAME）
echo "設定 DNS：$SUBDOMAIN → Tunnel..."
cloudflared tunnel route dns $TUNNEL_NAME $SUBDOMAIN

# 安裝為系統服務（開機自動啟動）
echo "設定開機自動啟動..."
sudo cloudflared service install

echo ""
echo "✅ 完成！"
echo ""
echo "外網網址：https://$SUBDOMAIN"
echo ""
echo "查看日誌：sudo tail -f /Library/Logs/com.cloudflare.cloudflared.log"
echo "停止服務：sudo launchctl stop com.cloudflare.cloudflared"

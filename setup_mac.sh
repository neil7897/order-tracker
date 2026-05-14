#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_SRC="$PROJECT_DIR/com.nicholas.order-tracker.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.nicholas.order-tracker.plist"

echo "=== Order Tracker 安裝中 ==="

# 安裝 Python 套件
echo "安裝套件..."
pip3 install -r "$PROJECT_DIR/requirements.txt" --quiet

# 寫入正確的專案路徑到 plist
sed "s|REPLACE_WITH_PROJECT_PATH|$PROJECT_DIR|g" "$PLIST_SRC" > "$PLIST_DST"

# 載入 launchd（開機自動啟動）
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"

# 等待啟動
sleep 2

# 取得本機 IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "請手動查詢 IP")

echo ""
echo "✅ 安裝完成！"
echo ""
echo "本機存取：http://localhost:8000"
echo "區網存取：http://$LOCAL_IP:8000"
echo ""
echo "日誌位置：/tmp/order-tracker.log"
echo "停止服務：launchctl unload ~/Library/LaunchAgents/com.nicholas.order-tracker.plist"

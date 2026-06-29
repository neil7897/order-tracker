import os
import requests
from datetime import date
from sqlalchemy.orm import Session
from .models import Order, InventoryItem

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")


def send_telegram(text: str):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    requests.post(
        f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
        json={"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"},
        timeout=10,
    )


def daily_reminder(db: Session):
    today = date.today()
    orders = db.query(Order).filter(Order.status != "已完成").all()
    urgent, soon = [], []
    for o in orders:
        days = (o.delivery_date - today).days
        branch = f" · {o.branch.name}" if o.branch else ""
        line = f"  {o.order_number}  {o.customer.name}{branch}  交貨：{o.delivery_date}（剩 {days} 天）"
        if days <= 3:
            urgent.append(line)
        elif days <= o.reminder_days:
            soon.append(line)

    parts = []
    if urgent or soon:
        parts.append(f"📦 <b>訂單到期提醒 {today}</b>")
        if urgent:
            parts.append("\n🔴 <b>緊急（3天內）</b>")
            parts.extend(urgent)
        if soon:
            parts.append("\n🟡 <b>即將到期</b>")
            parts.extend(soon)

    low_lines = low_stock_lines(db)
    if low_lines:
        if parts:
            parts.append("")  # 與訂單區塊間空一行
        parts.append(f"⚠️ <b>庫存不足提醒 {today}</b>")
        parts.extend(low_lines)

    if not parts:
        return

    send_telegram("\n".join(parts))


def low_stock_lines(db: Session):
    """回傳低於警告值的庫存品項清單（給每日通知用）。"""
    items = db.query(InventoryItem).filter(
        InventoryItem.quantity <= InventoryItem.low_threshold
    ).order_by(InventoryItem.category, InventoryItem.name).all()
    lines = []
    for it in items:
        lines.append(
            f"  🔻 {it.category}｜{it.name}：剩 {it.quantity} {it.unit}"
            f"（警告值 {it.low_threshold}）"
        )
    return lines

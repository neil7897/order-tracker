import os
import requests
from datetime import date
from sqlalchemy.orm import Session
from .models import Order

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

    if not urgent and not soon:
        return

    parts = [f"📦 <b>訂單到期提醒 {today}</b>"]
    if urgent:
        parts.append("\n🔴 <b>緊急（3天內）</b>")
        parts.extend(urgent)
    if soon:
        parts.append("\n🟡 <b>即將到期</b>")
        parts.extend(soon)

    send_telegram("\n".join(parts))

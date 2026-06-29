import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from apscheduler.schedulers.background import BackgroundScheduler
from backend.database import engine, Base, SessionLocal
from backend.routers import customers, staff, orders, phonebook, inventory
from backend.notify import daily_reminder

Base.metadata.create_all(bind=engine)

scheduler = BackgroundScheduler()

def run_daily():
    db = SessionLocal()
    try:
        daily_reminder(db)
    finally:
        db.close()

NOTIFY_HOUR   = int(os.environ.get("NOTIFY_HOUR", "8"))
NOTIFY_MINUTE = int(os.environ.get("NOTIFY_MINUTE", "30"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(run_daily, "cron", hour=NOTIFY_HOUR, minute=NOTIFY_MINUTE)
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(title="Order Tracker", lifespan=lifespan)

app.include_router(customers.router)
app.include_router(staff.router)
app.include_router(orders.router)
app.include_router(phonebook.router)
app.include_router(inventory.router)

app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
templates = Jinja2Templates(directory="frontend/templates")

@app.get("/")
def index(request: Request):
    return templates.TemplateResponse(request, "index.html")

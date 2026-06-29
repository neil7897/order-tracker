import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# 可用環境變數 DATABASE_URL 覆寫（例如 demo / 測試用獨立資料庫）
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./order_tracker.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

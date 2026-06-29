from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class OrderItemSizeIn(BaseModel):
    size: Optional[str] = None
    quantity: int = 0

class OrderItemIn(BaseModel):
    product_name: str
    sizes: list[OrderItemSizeIn] = []

class OrderIn(BaseModel):
    order_number: str
    customer_id: int
    branch_id: Optional[int] = None
    delivery_date: date
    reminder_days: int = 7
    notes: Optional[str] = None
    items: list[OrderItemIn] = []

class ProductionItemIn(BaseModel):
    name: str
    staff_id: Optional[int] = None
    expected_date: Optional[date] = None
    status: str = "未開始"

class ProductionNoteIn(BaseModel):
    content: str

class StatusUpdate(BaseModel):
    status: str
    actual_date: Optional[date] = None

class CustomerIn(BaseModel):
    name: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    line_id: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class BranchIn(BaseModel):
    customer_id: int
    name: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    line_id: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class StaffIn(BaseModel):
    name: str
    title: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    line_id: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class InventoryItemIn(BaseModel):
    category: str = "布"             # 布 / 副料
    name: str
    unit: str = "支"
    quantity: int = 0               # 建立時的起始庫存
    low_threshold: int = 4
    notes: Optional[str] = None

class InventoryAdjustIn(BaseModel):
    change: int                     # 正 = 補貨，負 = 用掉
    note: Optional[str] = None

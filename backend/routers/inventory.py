from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import InventoryItem, InventoryLog
from ..schemas import InventoryItemIn, InventoryAdjustIn

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


def _serialize(it: InventoryItem):
    return {
        "id": it.id,
        "category": it.category,
        "name": it.name,
        "unit": it.unit,
        "quantity": it.quantity,
        "low_threshold": it.low_threshold,
        "notes": it.notes,
        "low": it.quantity <= it.low_threshold,
        "logs": [
            {"id": lg.id, "change": lg.change, "balance_after": lg.balance_after,
             "note": lg.note, "created_at": lg.created_at.strftime("%Y-%m-%d %H:%M")}
            for lg in it.logs[:20]
        ],
    }


@router.get("")
def list_items(db: Session = Depends(get_db)):
    items = db.query(InventoryItem).order_by(
        InventoryItem.category, InventoryItem.name).all()
    return [_serialize(it) for it in items]


@router.post("")
def create_item(data: InventoryItemIn, db: Session = Depends(get_db)):
    it = InventoryItem(
        category=data.category, name=data.name, unit=data.unit,
        quantity=data.quantity, low_threshold=data.low_threshold, notes=data.notes,
    )
    db.add(it)
    db.commit()
    db.refresh(it)
    # 起始庫存記一筆異動，方便日後回溯
    if data.quantity:
        db.add(InventoryLog(item_id=it.id, change=data.quantity,
                            balance_after=it.quantity, note="建立品項（起始庫存）"))
        db.commit()
    return {"id": it.id}


@router.put("/{iid}")
def update_item(iid: int, data: InventoryItemIn, db: Session = Depends(get_db)):
    it = db.get(InventoryItem, iid)
    if not it:
        raise HTTPException(404)
    # 編輯品項資料（不直接動數量，數量請用補貨/用掉）
    it.category = data.category
    it.name = data.name
    it.unit = data.unit
    it.low_threshold = data.low_threshold
    it.notes = data.notes
    db.commit()
    return {"ok": True}


@router.delete("/{iid}")
def delete_item(iid: int, db: Session = Depends(get_db)):
    it = db.get(InventoryItem, iid)
    if not it:
        raise HTTPException(404)
    db.delete(it)
    db.commit()
    return {"ok": True}


@router.post("/{iid}/adjust")
def adjust_item(iid: int, data: InventoryAdjustIn, db: Session = Depends(get_db)):
    it = db.get(InventoryItem, iid)
    if not it:
        raise HTTPException(404)
    if data.change == 0:
        raise HTTPException(400, "異動數量不可為 0")
    new_qty = it.quantity + data.change
    if new_qty < 0:
        raise HTTPException(400, f"庫存不足，目前只剩 {it.quantity} {it.unit}")
    it.quantity = new_qty
    db.add(InventoryLog(item_id=it.id, change=data.change,
                        balance_after=new_qty, note=data.note))
    db.commit()
    return {"ok": True, "quantity": new_qty, "low": new_qty <= it.low_threshold}

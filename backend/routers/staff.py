from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Staff, ProductionItem
from ..schemas import StaffIn

router = APIRouter(prefix="/api/staff", tags=["staff"])


@router.get("")
def list_staff(db: Session = Depends(get_db)):
    staff = db.query(Staff).order_by(Staff.name).all()
    result = []
    for s in staff:
        active = db.query(ProductionItem).filter(
            ProductionItem.staff_id == s.id,
            ProductionItem.status.notin_(["完成"])
        ).count()
        result.append({
            "id": s.id, "name": s.name, "title": s.title,
            "phone": s.phone, "email": s.email, "line_id": s.line_id,
            "address": s.address, "notes": s.notes,
            "active_items": active
        })
    return result


@router.post("")
def create_staff(data: StaffIn, db: Session = Depends(get_db)):
    s = Staff(**data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "name": s.name}


@router.put("/{sid}")
def update_staff(sid: int, data: StaffIn, db: Session = Depends(get_db)):
    s = db.get(Staff, sid)
    if not s:
        raise HTTPException(404)
    for k, v in data.model_dump().items():
        setattr(s, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/{sid}")
def delete_staff(sid: int, db: Session = Depends(get_db)):
    s = db.get(Staff, sid)
    if not s:
        raise HTTPException(404)
    db.delete(s)
    db.commit()
    return {"ok": True}

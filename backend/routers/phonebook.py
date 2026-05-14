from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Customer, Branch, Staff

router = APIRouter(prefix="/api/phonebook", tags=["phonebook"])


@router.get("")
def phonebook(db: Session = Depends(get_db)):
    result = []
    for c in db.query(Customer).all():
        result.append({
            "type": "客戶", "id": c.id, "name": c.name,
            "contact_name": c.contact_name, "phone": c.phone,
            "email": c.email, "line_id": c.line_id, "address": c.address,
            "parent": None
        })
    for b in db.query(Branch).all():
        result.append({
            "type": "院區", "id": b.id, "name": b.name,
            "contact_name": b.contact_name, "phone": b.phone,
            "email": b.email, "line_id": b.line_id, "address": b.address,
            "parent": b.customer.name if b.customer else ""
        })
    for s in db.query(Staff).all():
        result.append({
            "type": "人員", "id": s.id, "name": s.name,
            "contact_name": s.name, "phone": s.phone,
            "email": s.email, "line_id": s.line_id, "address": s.address,
            "parent": s.title
        })
    return result

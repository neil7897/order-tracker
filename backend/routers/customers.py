from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Customer, Branch
from ..schemas import CustomerIn, BranchIn

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("")
def list_customers(db: Session = Depends(get_db)):
    customers = db.query(Customer).order_by(Customer.name).all()
    result = []
    for c in customers:
        order_count = len(c.orders)
        result.append({
            "id": c.id, "name": c.name, "contact_name": c.contact_name,
            "phone": c.phone, "email": c.email, "line_id": c.line_id,
            "address": c.address, "notes": c.notes,
            "order_count": order_count,
            "branches": [{"id": b.id, "name": b.name, "contact_name": b.contact_name,
                          "phone": b.phone, "email": b.email, "line_id": b.line_id,
                          "address": b.address} for b in c.branches]
        })
    return result


@router.post("")
def create_customer(data: CustomerIn, db: Session = Depends(get_db)):
    c = Customer(**data.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "name": c.name}


@router.put("/{cid}")
def update_customer(cid: int, data: CustomerIn, db: Session = Depends(get_db)):
    c = db.get(Customer, cid)
    if not c:
        raise HTTPException(404)
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/{cid}")
def delete_customer(cid: int, db: Session = Depends(get_db)):
    c = db.get(Customer, cid)
    if not c:
        raise HTTPException(404)
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.post("/{cid}/branches")
def add_branch(cid: int, data: BranchIn, db: Session = Depends(get_db)):
    if not db.get(Customer, cid):
        raise HTTPException(404)
    b = Branch(**data.model_dump())
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"id": b.id, "name": b.name}


@router.put("/branches/{bid}")
def update_branch(bid: int, data: BranchIn, db: Session = Depends(get_db)):
    b = db.get(Branch, bid)
    if not b:
        raise HTTPException(404)
    for k, v in data.model_dump().items():
        setattr(b, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/branches/{bid}")
def delete_branch(bid: int, db: Session = Depends(get_db)):
    b = db.get(Branch, bid)
    if not b:
        raise HTTPException(404)
    db.delete(b)
    db.commit()
    return {"ok": True}

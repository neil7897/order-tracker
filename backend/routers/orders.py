from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from ..models import Order, OrderItem, OrderItemSize, ProductionItem, ProductionNote
from ..schemas import OrderIn, ProductionItemIn, ProductionNoteIn, StatusUpdate

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _days_left(d: date) -> int:
    return (d - date.today()).days


def _order_dict(o: Order) -> dict:
    days = _days_left(o.delivery_date)
    urgency = "urgent" if days <= 3 else "soon" if days <= 7 else "ok"
    return {
        "id": o.id, "order_number": o.order_number,
        "customer_id": o.customer_id,
        "customer_name": o.customer.name if o.customer else "",
        "branch_id": o.branch_id,
        "branch_name": o.branch.name if o.branch else "",
        "delivery_date": str(o.delivery_date),
        "reminder_days": o.reminder_days,
        "status": o.status, "notes": o.notes,
        "days_left": days, "urgency": urgency,
        "created_at": str(o.created_at),
        "items": [
            {"id": i.id, "product_name": i.product_name,
             "sizes": [{"id": s.id, "size": s.size, "quantity": s.quantity} for s in i.sizes]}
            for i in o.items
        ],
        "production": [
            {"id": p.id, "name": p.name, "status": p.status,
             "staff_id": p.staff_id,
             "staff_name": p.staff.name if p.staff else "",
             "expected_date": str(p.expected_date) if p.expected_date else None,
             "actual_date": str(p.actual_date) if p.actual_date else None,
             "notes": [{"id": n.id, "content": n.content, "created_at": str(n.created_at)} for n in p.notes]}
            for p in o.production
        ]
    }


@router.get("")
def list_orders(db: Session = Depends(get_db)):
    orders = (db.query(Order)
              .options(joinedload(Order.customer), joinedload(Order.branch),
                       joinedload(Order.items).joinedload(OrderItem.sizes),
                       joinedload(Order.production).joinedload(ProductionItem.staff))
              .order_by(Order.delivery_date)
              .all())
    return [_order_dict(o) for o in orders]


@router.post("")
def create_order(data: OrderIn, db: Session = Depends(get_db)):
    last = db.query(Order).order_by(Order.id.desc()).first()
    num = (last.id + 1) if last else 1
    order_number = f"#{date.today().year}-{num:03d}"
    order = Order(
        order_number=order_number,
        customer_id=data.customer_id,
        branch_id=data.branch_id,
        delivery_date=data.delivery_date,
        reminder_days=data.reminder_days,
        notes=data.notes,
    )
    db.add(order)
    db.flush()
    for item_data in data.items:
        item = OrderItem(order_id=order.id, product_name=item_data.product_name)
        db.add(item)
        db.flush()
        for s in item_data.sizes:
            db.add(OrderItemSize(item_id=item.id, size=s.size, quantity=s.quantity))
    db.commit()
    db.refresh(order)
    return {"id": order.id, "order_number": order.order_number}


@router.get("/{oid}")
def get_order(oid: int, db: Session = Depends(get_db)):
    o = (db.query(Order)
         .options(joinedload(Order.customer), joinedload(Order.branch),
                  joinedload(Order.items).joinedload(OrderItem.sizes),
                  joinedload(Order.production).joinedload(ProductionItem.staff)
                                            .joinedload(ProductionItem.notes))
         .filter(Order.id == oid).first())
    if not o:
        raise HTTPException(404)
    return _order_dict(o)


@router.put("/{oid}/status")
def update_order_status(oid: int, data: StatusUpdate, db: Session = Depends(get_db)):
    o = db.get(Order, oid)
    if not o:
        raise HTTPException(404)
    o.status = data.status
    db.commit()
    return {"ok": True}


@router.delete("/{oid}")
def delete_order(oid: int, db: Session = Depends(get_db)):
    o = db.get(Order, oid)
    if not o:
        raise HTTPException(404)
    db.delete(o)
    db.commit()
    return {"ok": True}


@router.post("/{oid}/production")
def add_production_item(oid: int, data: ProductionItemIn, db: Session = Depends(get_db)):
    if not db.get(Order, oid):
        raise HTTPException(404)
    p = ProductionItem(order_id=oid, **data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id}


@router.put("/production/{pid}/status")
def update_production_status(pid: int, data: StatusUpdate, db: Session = Depends(get_db)):
    p = db.get(ProductionItem, pid)
    if not p:
        raise HTTPException(404)
    p.status = data.status
    if data.actual_date:
        p.actual_date = data.actual_date
    db.commit()
    return {"ok": True}


@router.post("/production/{pid}/notes")
def add_production_note(pid: int, data: ProductionNoteIn, db: Session = Depends(get_db)):
    if not db.get(ProductionItem, pid):
        raise HTTPException(404)
    n = ProductionNote(item_id=pid, content=data.content)
    db.add(n)
    db.commit()
    db.refresh(n)
    return {"id": n.id}

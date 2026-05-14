from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


class Customer(Base):
    __tablename__ = "customers"
    id           = Column(Integer, primary_key=True)
    name         = Column(String(100), nullable=False)
    contact_name = Column(String(100))
    phone        = Column(String(50))
    email        = Column(String(100))
    line_id      = Column(String(100))
    address      = Column(Text)
    notes        = Column(Text)
    created_at   = Column(DateTime, default=datetime.now)
    branches     = relationship("Branch", back_populates="customer", cascade="all, delete-orphan")
    orders       = relationship("Order", back_populates="customer")


class Branch(Base):
    __tablename__ = "branches"
    id           = Column(Integer, primary_key=True)
    customer_id  = Column(Integer, ForeignKey("customers.id"), nullable=False)
    name         = Column(String(100), nullable=False)
    contact_name = Column(String(100))
    phone        = Column(String(50))
    email        = Column(String(100))
    line_id      = Column(String(100))
    address      = Column(Text)
    notes        = Column(Text)
    created_at   = Column(DateTime, default=datetime.now)
    customer     = relationship("Customer", back_populates="branches")
    orders       = relationship("Order", back_populates="branch")


class Staff(Base):
    __tablename__ = "staff"
    id           = Column(Integer, primary_key=True)
    name         = Column(String(100), nullable=False)
    title        = Column(String(100))
    phone        = Column(String(50))
    email        = Column(String(100))
    line_id      = Column(String(100))
    address      = Column(Text)
    notes        = Column(Text)
    created_at   = Column(DateTime, default=datetime.now)
    production_items = relationship("ProductionItem", back_populates="staff")


class Order(Base):
    __tablename__ = "orders"
    id            = Column(Integer, primary_key=True)
    order_number  = Column(String(50), unique=True, nullable=False)
    customer_id   = Column(Integer, ForeignKey("customers.id"), nullable=False)
    branch_id     = Column(Integer, ForeignKey("branches.id"))
    delivery_date = Column(Date, nullable=False)
    reminder_days = Column(Integer, default=7)
    status        = Column(String(50), default="製作中")
    notes         = Column(Text)
    created_at    = Column(DateTime, default=datetime.now)
    customer      = relationship("Customer", back_populates="orders")
    branch        = relationship("Branch", back_populates="orders")
    items         = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    production    = relationship("ProductionItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"
    id           = Column(Integer, primary_key=True)
    order_id     = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_name = Column(String(200), nullable=False)
    order        = relationship("Order", back_populates="items")
    sizes        = relationship("OrderItemSize", back_populates="item", cascade="all, delete-orphan")


class OrderItemSize(Base):
    __tablename__ = "order_item_sizes"
    id       = Column(Integer, primary_key=True)
    item_id  = Column(Integer, ForeignKey("order_items.id"), nullable=False)
    size     = Column(String(50))
    quantity = Column(Integer, default=0)
    item     = relationship("OrderItem", back_populates="sizes")


class ProductionItem(Base):
    __tablename__ = "production_items"
    id            = Column(Integer, primary_key=True)
    order_id      = Column(Integer, ForeignKey("orders.id"), nullable=False)
    staff_id      = Column(Integer, ForeignKey("staff.id"))
    name          = Column(String(200), nullable=False)
    expected_date = Column(Date)
    actual_date   = Column(Date)
    status        = Column(String(50), default="未開始")
    created_at    = Column(DateTime, default=datetime.now)
    order         = relationship("Order", back_populates="production")
    staff         = relationship("Staff", back_populates="production_items")
    notes         = relationship("ProductionNote", back_populates="item", cascade="all, delete-orphan")


class ProductionNote(Base):
    __tablename__ = "production_notes"
    id         = Column(Integer, primary_key=True)
    item_id    = Column(Integer, ForeignKey("production_items.id"), nullable=False)
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    item       = relationship("ProductionItem", back_populates="notes")

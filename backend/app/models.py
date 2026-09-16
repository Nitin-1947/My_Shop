"""
SQLAlchemy ORM models — 7 tables implementing PRD §11–16.
"""
from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, Float, ForeignKey,
    Integer, Numeric, String, Text, UniqueConstraint, func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


# ── Enumerations ─────────────────────────────────────────────────────────────

class BillType(str, enum.Enum):
    SIMULATED = "SIMULATED"
    MANUAL = "MANUAL"


class GenerationMode(str, enum.Enum):
    DOSE = "DOSE"
    GENERIC = "GENERIC"


class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class MedicineUnit(str, enum.Enum):
    TABLET = "TABLET"
    CAPSULE = "CAPSULE"
    SYRUP = "SYRUP"
    INJECTION = "INJECTION"
    CREAM = "CREAM"
    DROPS = "DROPS"
    INHALER = "INHALER"
    SACHET = "SACHET"
    OTHER = "OTHER"


# ── Models ────────────────────────────────────────────────────────────────────

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(Enum(Gender), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    status = Column(Boolean, default=True, nullable=False)  # True = active
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    bills = relationship("Bill", back_populates="patient")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    doctor_code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    specialization = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    status = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    bills = relationship("Bill", back_populates="doctor")


class GenericDrug(Base):
    __tablename__ = "generic_drugs"

    id = Column(Integer, primary_key=True, index=True)
    generic_code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    medicines = relationship("Medicine", back_populates="generic_drug")


class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    medicine_code = Column(String(30), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    generic_drug_id = Column(Integer, ForeignKey("generic_drugs.id"), nullable=False)
    batch_number = Column(String(30), nullable=False)
    expiry_date = Column(Date, nullable=False)
    mrp = Column(Numeric(10, 2), nullable=False)
    unit = Column(Enum(MedicineUnit), default=MedicineUnit.TABLET, nullable=False)
    stock_qty = Column(Integer, default=0, nullable=False)
    status = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    generic_drug = relationship("GenericDrug", back_populates="medicines")
    dose_pattern_items = relationship("DosePatternItem", back_populates="medicine")

    @property
    def is_expired(self) -> bool:
        return self.expiry_date < date.today()


class DosePattern(Base):
    __tablename__ = "dose_patterns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    illness_name = Column(String(120), nullable=False)
    status = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    items = relationship(
        "DosePatternItem",
        back_populates="dose_pattern",
        cascade="all, delete-orphan",
    )


class DosePatternItem(Base):
    __tablename__ = "dose_pattern_items"

    id = Column(Integer, primary_key=True, index=True)
    dose_pattern_id = Column(
        Integer, ForeignKey("dose_patterns.id", ondelete="CASCADE"), nullable=False
    )
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)

    __table_args__ = (
        UniqueConstraint("dose_pattern_id", "medicine_id", name="uq_pattern_medicine"),
    )

    dose_pattern = relationship("DosePattern", back_populates="items")
    medicine = relationship("Medicine", back_populates="dose_pattern_items")


class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_number = Column(String(30), unique=True, nullable=False, index=True)
    bill_type = Column(Enum(BillType), nullable=False)           # DB-level enforcement
    generation_mode = Column(Enum(GenerationMode), nullable=True)  # null for MANUAL
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    discount = Column(Numeric(12, 2), nullable=False, default=0)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    patient = relationship("Patient", back_populates="bills")
    doctor = relationship("Doctor", back_populates="bills")
    items = relationship(
        "BillItem",
        back_populates="bill",
        cascade="all, delete-orphan",
    )


class BillItem(Base):
    __tablename__ = "bill_items"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id", ondelete="CASCADE"), nullable=False)

    # ── Snapshot of medicine data at billing time ─────────────────────────────
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=True)
    medicine_name = Column(String(150), nullable=False)
    generic_name = Column(String(120), nullable=False)
    batch_number = Column(String(30), nullable=False)
    expiry_date = Column(Date, nullable=False)
    mrp = Column(Numeric(10, 2), nullable=False)
    unit = Column(String(20), nullable=False)
    quantity = Column(Integer, nullable=False)
    line_total = Column(Numeric(12, 2), nullable=False)

    bill = relationship("Bill", back_populates="items")

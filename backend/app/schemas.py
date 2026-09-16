"""
Pydantic v2 request/response schemas — mirrors models.py exactly.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import BillType, Gender, GenerationMode, MedicineUnit


# ── Shared helpers ────────────────────────────────────────────────────────────

class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Patient ───────────────────────────────────────────────────────────────────

class PatientCreate(BaseModel):
    patient_code: str = Field(..., max_length=20)
    name: str = Field(..., max_length=120)
    age: Optional[int] = Field(None, ge=0, le=150)
    gender: Optional[Gender] = None
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    status: bool = True


class PatientUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    age: Optional[int] = Field(None, ge=0, le=150)
    gender: Optional[Gender] = None
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    status: Optional[bool] = None


class PatientOut(OrmBase):
    id: int
    patient_code: str
    name: str
    age: Optional[int]
    gender: Optional[Gender]
    phone: Optional[str]
    address: Optional[str]
    status: bool
    created_at: datetime


# ── Doctor ────────────────────────────────────────────────────────────────────

class DoctorCreate(BaseModel):
    doctor_code: str = Field(..., max_length=20)
    name: str = Field(..., max_length=120)
    specialization: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    status: bool = True


class DoctorUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    specialization: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    status: Optional[bool] = None


class DoctorOut(OrmBase):
    id: int
    doctor_code: str
    name: str
    specialization: Optional[str]
    phone: Optional[str]
    status: bool
    created_at: datetime


# ── Generic Drug ──────────────────────────────────────────────────────────────

class GenericDrugCreate(BaseModel):
    generic_code: str = Field(..., max_length=20)
    name: str = Field(..., max_length=120)


class GenericDrugOut(OrmBase):
    id: int
    generic_code: str
    name: str
    created_at: datetime


# ── Medicine ──────────────────────────────────────────────────────────────────

class MedicineCreate(BaseModel):
    medicine_code: str = Field(..., max_length=30)
    name: str = Field(..., max_length=150)
    generic_drug_id: int
    batch_number: str = Field(..., max_length=30)
    expiry_date: date
    mrp: Decimal = Field(..., gt=0, decimal_places=2)
    unit: MedicineUnit = MedicineUnit.TABLET
    stock_qty: int = Field(0, ge=0)
    status: bool = True


class MedicineUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    batch_number: Optional[str] = Field(None, max_length=30)
    expiry_date: Optional[date] = None
    mrp: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    unit: Optional[MedicineUnit] = None
    stock_qty: Optional[int] = Field(None, ge=0)
    status: Optional[bool] = None


class MedicineOut(OrmBase):
    id: int
    medicine_code: str
    name: str
    generic_drug_id: int
    generic_name: Optional[str] = None   # populated via join in routers
    batch_number: str
    expiry_date: date
    mrp: Decimal
    unit: MedicineUnit
    stock_qty: int
    status: bool
    is_expired: bool
    created_at: datetime

    @field_validator("is_expired", mode="before")
    @classmethod
    def compute_expired(cls, v, info):
        # is_expired is a @property on the ORM model — Pydantic reads it fine
        return v


# ── Dose Pattern ──────────────────────────────────────────────────────────────

class DosePatternItemCreate(BaseModel):
    medicine_id: int
    quantity: int = Field(..., gt=0)


class DosePatternItemOut(OrmBase):
    id: int
    medicine_id: int
    medicine_name: Optional[str] = None
    quantity: int


class DosePatternCreate(BaseModel):
    name: str = Field(..., max_length=120)
    illness_name: str = Field(..., max_length=120)
    status: bool = True
    items: list[DosePatternItemCreate] = Field(default_factory=list)


class DosePatternOut(OrmBase):
    id: int
    name: str
    illness_name: str
    status: bool
    created_at: datetime
    items: list[DosePatternItemOut] = []


# ── Bill Items ────────────────────────────────────────────────────────────────

class BillItemOut(OrmBase):
    id: int
    medicine_id: Optional[int]
    medicine_name: str
    generic_name: str
    batch_number: str
    expiry_date: date
    mrp: Decimal
    unit: str
    quantity: int
    line_total: Decimal


class ManualBillItemIn(BaseModel):
    medicine_id: int
    quantity: int = Field(..., gt=0)


# ── Bill ──────────────────────────────────────────────────────────────────────

class BillOut(OrmBase):
    id: int
    bill_number: str
    bill_type: BillType
    generation_mode: Optional[GenerationMode]
    patient_id: int
    patient_name: Optional[str] = None
    doctor_id: int
    doctor_name: Optional[str] = None
    subtotal: Decimal
    discount: Decimal
    total_amount: Decimal
    notes: Optional[str]
    created_at: datetime
    items: list[BillItemOut] = []


class ManualBillCreate(BaseModel):
    patient_id: int
    doctor_id: int
    items: list[ManualBillItemIn] = Field(..., min_length=1)
    discount: Decimal = Field(Decimal("0"), ge=0)
    notes: Optional[str] = None


# ── Generation ────────────────────────────────────────────────────────────────

class GenerationRequest(BaseModel):
    count: int = Field(1, ge=1, le=100)
    seed: Optional[int] = None
    dose_ratio: float = Field(0.5, ge=0.0, le=1.0)


class GenerationResponse(BaseModel):
    generated: int
    skipped: int
    bills: list[BillOut]


# ── Generic import helpers ────────────────────────────────────────────────────

class ImportResult(BaseModel):
    inserted: int
    skipped: int
    errors: list[str] = []

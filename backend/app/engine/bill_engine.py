"""
Bill Engine — orchestrates bill numbering, batch generation, manual billing, and persistence.
Pure Python — no FastAPI/UI imports.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Bill, BillItem, BillType, Doctor, GenerationMode, Patient
from app.engine.random_engine import (
    ItemCandidate,
    generate_dose_based_items,
    generate_generic_based_items,
    validate_items,
)


# ── Bill numbering (PRD Rule 16) ──────────────────────────────────────────────

def _next_bill_number(db: Session, bill_type: BillType, today: Optional[date] = None) -> str:
    """
    SIM-YYYYMMDD-#### for simulated bills.
    MAN-YYYYMMDD-#### for manual bills.
    Sequence is per-day per-type, starting at 0001.
    """
    today = today or date.today()
    prefix = "SIM" if bill_type == BillType.SIMULATED else "MAN"
    date_str = today.strftime("%Y%m%d")

    # Count existing bills of this type today
    pattern = f"{prefix}-{date_str}-%"
    count = (
        db.query(Bill)
        .filter(Bill.bill_number.like(pattern))
        .count()
    )
    seq = count + 1
    return f"{prefix}-{date_str}-{seq:04d}"


# ── Totals ────────────────────────────────────────────────────────────────────

def _compute_totals(items: list[ItemCandidate], discount: Decimal = Decimal("0")):
    subtotal = Decimal(str(sum(i.line_total for i in items)))
    total = max(Decimal("0"), subtotal - discount)
    return subtotal, discount, total


# ── Persistence helper ────────────────────────────────────────────────────────

def _persist_bill(
    db: Session,
    *,
    bill_number: str,
    bill_type: BillType,
    generation_mode: Optional[GenerationMode],
    patient_id: int,
    doctor_id: int,
    items: list[ItemCandidate],
    discount: Decimal = Decimal("0"),
    notes: Optional[str] = None,
) -> Bill:
    subtotal, discount, total = _compute_totals(items, discount)

    bill = Bill(
        bill_number=bill_number,
        bill_type=bill_type,
        generation_mode=generation_mode,
        patient_id=patient_id,
        doctor_id=doctor_id,
        subtotal=subtotal,
        discount=discount,
        total_amount=total,
        notes=notes,
    )
    db.add(bill)
    db.flush()  # get bill.id before creating items

    for item in items:
        bill_item = BillItem(
            bill_id=bill.id,
            medicine_id=item.medicine_id,
            medicine_name=item.medicine_name,
            generic_name=item.generic_name,
            batch_number=item.batch_number,
            expiry_date=item.expiry_date,
            mrp=Decimal(str(item.mrp)),
            unit=item.unit,
            quantity=item.quantity,
            line_total=Decimal(str(item.line_total)),
        )
        db.add(bill_item)

    db.commit()
    db.refresh(bill)
    return bill


# ── Batch random generation (PRD Rule 10/11) ─────────────────────────────────

@dataclass
class GenerationResult:
    bills: list[Bill] = field(default_factory=list)
    skipped: int = 0


def generate_random_bills(
    db: Session,
    count: int,
    seed: Optional[int] = None,
    dose_ratio: float = 0.5,
) -> GenerationResult:
    """
    Generate `count` simulated bills.
    - seed → reproducible output (same seed + same data = same bills)
    - dose_ratio → probability that a bill uses dose-based mode (default 0.5)
    - Falls back to the other mode once if the chosen mode returns empty.
    """
    rng = random.Random(seed)
    result = GenerationResult()

    # Active patients and doctors for random selection
    active_patients = db.query(Patient).filter(Patient.status.is_(True)).all()
    active_doctors = db.query(Doctor).filter(Doctor.status.is_(True)).all()

    if not active_patients or not active_doctors:
        result.skipped = count
        return result

    for _ in range(count):
        patient = rng.choice(active_patients)
        doctor = rng.choice(active_doctors)
        use_dose = rng.random() < dose_ratio

        # Primary attempt
        if use_dose:
            items = generate_dose_based_items(db, rng)
            mode = GenerationMode.DOSE
        else:
            items = generate_generic_based_items(db, rng)
            mode = GenerationMode.GENERIC

        # Fallback (PRD: if chosen mode fails, try the other once)
        if not items:
            if use_dose:
                items = generate_generic_based_items(db, rng)
                mode = GenerationMode.GENERIC
            else:
                items = generate_dose_based_items(db, rng)
                mode = GenerationMode.DOSE

        if not items:
            result.skipped += 1
            continue

        # Final validation pass
        items = validate_items(items)
        if not items:
            result.skipped += 1
            continue

        bill_number = _next_bill_number(db, BillType.SIMULATED)
        bill = _persist_bill(
            db,
            bill_number=bill_number,
            bill_type=BillType.SIMULATED,
            generation_mode=mode,
            patient_id=patient.id,
            doctor_id=doctor.id,
            items=items,
        )
        result.bills.append(bill)

    return result


# ── Manual billing (PRD §100 Phase 4) ────────────────────────────────────────

class ManualBillError(Exception):
    pass


def create_manual_bill(
    db: Session,
    *,
    patient_id: int,
    doctor_id: int,
    raw_items: list[dict],   # [{"medicine_id": int, "quantity": int}, ...]
    discount: Decimal = Decimal("0"),
    notes: Optional[str] = None,
) -> Bill:
    """
    Create a manual bill.
    Rules (PRD §7 Manual):
    - Skips duplicate-generic check (real prescriptions can combine same-generic brands)
    - Still rejects expired medicines and non-positive quantities
    - Raises ManualBillError on any violation
    """
    from app.models import Medicine
    from datetime import date

    if not raw_items:
        raise ManualBillError("At least one item is required.")

    today = date.today()
    items: list[ItemCandidate] = []

    for raw in raw_items:
        med_id = raw["medicine_id"]
        qty = raw["quantity"]

        if qty <= 0:
            raise ManualBillError(f"Quantity must be > 0 for medicine_id={med_id}.")

        med = db.query(Medicine).filter(Medicine.id == med_id).first()
        if not med:
            raise ManualBillError(f"Medicine id={med_id} not found.")
        if not med.status:
            raise ManualBillError(f"Medicine '{med.name}' is inactive.")
        if med.expiry_date <= today:
            raise ManualBillError(
                f"Medicine '{med.name}' (batch {med.batch_number}) is expired."
            )

        items.append(
            ItemCandidate(
                medicine_id=med.id,
                medicine_name=med.name,
                generic_drug_id=med.generic_drug_id,
                generic_name=med.generic_drug.name,
                batch_number=med.batch_number,
                expiry_date=med.expiry_date,
                mrp=float(med.mrp),
                unit=med.unit.value,
                quantity=qty,
            )
        )

    bill_number = _next_bill_number(db, BillType.MANUAL)
    return _persist_bill(
        db,
        bill_number=bill_number,
        bill_type=BillType.MANUAL,
        generation_mode=None,
        patient_id=patient_id,
        doctor_id=doctor_id,
        items=items,
        discount=discount,
        notes=notes,
    )

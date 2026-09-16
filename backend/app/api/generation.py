"""
Generation router — POST /api/generation/random
Thin HTTP wrapper around bill_engine.generate_random_bills().
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.engine.bill_engine import generate_random_bills
from app.schemas import BillItemOut, BillOut, GenerationRequest, GenerationResponse

router = APIRouter(prefix="/api/generation", tags=["Generation"])


def _bill_to_schema(bill) -> BillOut:
    return BillOut(
        id=bill.id,
        bill_number=bill.bill_number,
        bill_type=bill.bill_type,
        generation_mode=bill.generation_mode,
        patient_id=bill.patient_id,
        patient_name=bill.patient.name if bill.patient else None,
        doctor_id=bill.doctor_id,
        doctor_name=bill.doctor.name if bill.doctor else None,
        subtotal=bill.subtotal,
        discount=bill.discount,
        total_amount=bill.total_amount,
        notes=bill.notes,
        created_at=bill.created_at,
        items=[
            BillItemOut(
                id=item.id,
                medicine_id=item.medicine_id,
                medicine_name=item.medicine_name,
                generic_name=item.generic_name,
                batch_number=item.batch_number,
                expiry_date=item.expiry_date,
                mrp=item.mrp,
                unit=item.unit,
                quantity=item.quantity,
                line_total=item.line_total,
            )
            for item in bill.items
        ],
    )


@router.post("/random", response_model=GenerationResponse)
def generate_random(body: GenerationRequest, db: Session = Depends(get_db)):
    """
    Generate `count` simulated bills.
    Optionally pass `seed` for reproducible output.
    `dose_ratio` (0.0–1.0) controls dose-based vs generic-based split (default 0.5).
    """
    result = generate_random_bills(
        db,
        count=body.count,
        seed=body.seed,
        dose_ratio=body.dose_ratio,
    )

    if result.skipped == body.count:
        raise HTTPException(
            422,
            "All bills were skipped. Ensure active patients, doctors, "
            "and non-expired medicines exist in the database (run seed.py).",
        )

    return GenerationResponse(
        generated=len(result.bills),
        skipped=result.skipped,
        bills=[_bill_to_schema(b) for b in result.bills],
    )

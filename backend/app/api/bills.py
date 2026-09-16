"""
Bills router — history, single bill, PDF download, manual creation.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.engine.bill_engine import ManualBillError, create_manual_bill
from app.engine.pdf_engine import render_bill_pdf
from app.models import Bill, BillType
from app.schemas import BillItemOut, BillOut, ManualBillCreate

router = APIRouter(prefix="/api/bills", tags=["Bills"])


def _bill_to_schema(bill: Bill) -> BillOut:
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


@router.get("", response_model=list[BillOut])
def list_bills(
    bill_type: Optional[BillType] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(settings.BILL_HISTORY_LIMIT, le=settings.BILL_HISTORY_LIMIT),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(Bill)
    if bill_type:
        q = q.filter(Bill.bill_type == bill_type)
    if search:
        q = q.filter(
            Bill.bill_number.ilike(f"%{search}%")
            | Bill.patient.has(Bill.patient_id.isnot(None))
        )
    bills = q.order_by(Bill.created_at.desc()).offset(offset).limit(limit).all()
    return [_bill_to_schema(b) for b in bills]


@router.get("/stats")
def bill_stats(db: Session = Depends(get_db)):
    """Quick stats for the dashboard."""
    from app.models import Patient, Doctor, Medicine
    from datetime import date
    total = db.query(Bill).count()
    simulated = db.query(Bill).filter(Bill.bill_type == BillType.SIMULATED).count()
    manual = db.query(Bill).filter(Bill.bill_type == BillType.MANUAL).count()
    patients = db.query(Patient).count()
    doctors = db.query(Doctor).count()
    medicines = db.query(Medicine).count()
    expired = db.query(Medicine).filter(Medicine.expiry_date <= date.today()).count()
    return {
        "total_bills": total,
        "simulated_bills": simulated,
        "manual_bills": manual,
        "total_patients": patients,
        "total_doctors": doctors,
        "total_medicines": medicines,
        "expired_medicines": expired,
    }


@router.get("/{bill_id}", response_model=BillOut)
def get_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")
    return _bill_to_schema(bill)


@router.get("/{bill_id}/pdf")
def download_pdf(bill_id: int, db: Session = Depends(get_db)):
    """Stream the rendered PDF for a bill."""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")
    pdf_bytes = render_bill_pdf(bill)
    filename = f"{bill.bill_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/manual", response_model=BillOut)
def create_manual(body: ManualBillCreate, db: Session = Depends(get_db)):
    """Create a manual bill (real prescription). No duplicate-generic check."""
    try:
        bill = create_manual_bill(
            db,
            patient_id=body.patient_id,
            doctor_id=body.doctor_id,
            raw_items=[{"medicine_id": i.medicine_id, "quantity": i.quantity} for i in body.items],
            discount=body.discount,
            notes=body.notes,
        )
    except ManualBillError as exc:
        raise HTTPException(422, str(exc))
    return _bill_to_schema(bill)

"""
Medicines router — GET/POST/PUT/DELETE + CSV import.
CSV import auto-creates missing generic drugs.
"""
from __future__ import annotations

import csv
import io
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import GenericDrug, Medicine, MedicineUnit
from app.schemas import ImportResult, MedicineCreate, MedicineOut, MedicineUpdate

router = APIRouter(prefix="/api/medicines", tags=["Medicines"])


def _enrich(med: Medicine) -> dict:
    """Add generic_name and is_expired to the ORM object for schema."""
    med.generic_name = med.generic_drug.name if med.generic_drug else None
    return med


def _get_or_404(db: Session, med_id: int) -> Medicine:
    m = db.query(Medicine).filter(Medicine.id == med_id).first()
    if not m:
        raise HTTPException(404, "Medicine not found")
    return m


@router.get("", response_model=list[MedicineOut])
def list_medicines(
    search: Optional[str] = Query(None),
    generic_id: Optional[int] = Query(None),
    expired: Optional[bool] = Query(None),
    status: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    today = date.today()
    q = db.query(Medicine)
    if search:
        q = q.filter(Medicine.name.ilike(f"%{search}%") | Medicine.medicine_code.ilike(f"%{search}%"))
    if generic_id is not None:
        q = q.filter(Medicine.generic_drug_id == generic_id)
    if expired is True:
        q = q.filter(Medicine.expiry_date <= today)
    elif expired is False:
        q = q.filter(Medicine.expiry_date > today)
    if status is not None:
        q = q.filter(Medicine.status == status)
    meds = q.order_by(Medicine.name).limit(500).all()
    return [_enrich(m) for m in meds]


@router.get("/{medicine_id}", response_model=MedicineOut)
def get_medicine(medicine_id: int, db: Session = Depends(get_db)):
    return _enrich(_get_or_404(db, medicine_id))


@router.post("", response_model=MedicineOut, status_code=status.HTTP_201_CREATED)
def create_medicine(body: MedicineCreate, db: Session = Depends(get_db)):
    if db.query(Medicine).filter(Medicine.medicine_code == body.medicine_code).first():
        raise HTTPException(400, f"Medicine code '{body.medicine_code}' already exists")
    if not db.query(GenericDrug).filter(GenericDrug.id == body.generic_drug_id).first():
        raise HTTPException(400, f"Generic drug id={body.generic_drug_id} not found")
    m = Medicine(**body.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return _enrich(m)


@router.put("/{medicine_id}", response_model=MedicineOut)
def update_medicine(medicine_id: int, body: MedicineUpdate, db: Session = Depends(get_db)):
    m = _get_or_404(db, medicine_id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return _enrich(m)


@router.delete("/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medicine(medicine_id: int, db: Session = Depends(get_db)):
    m = _get_or_404(db, medicine_id)
    db.delete(m)
    db.commit()


@router.post("/import", response_model=ImportResult)
async def import_medicines(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    CSV columns: medicine_code, name, generic_code (or generic_name), batch_number,
                 expiry_date (YYYY-MM-DD), mrp, unit, stock_qty (opt), status (opt)
    Auto-creates missing generic drugs using generic_code + generic_name.
    """
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    inserted = skipped = 0
    errors: list[str] = []

    for row in reader:
        code = row.get("medicine_code", "").strip()
        name = row.get("name", "").strip()
        if not code or not name:
            errors.append(f"Missing medicine_code or name: {row}")
            continue
        if db.query(Medicine).filter(Medicine.medicine_code == code).first():
            skipped += 1
            continue
        try:
            # Resolve or create generic
            g_code = row.get("generic_code", "").strip()
            g_name = row.get("generic_name", row.get("generic_code", "")).strip()
            generic = db.query(GenericDrug).filter(GenericDrug.generic_code == g_code).first()
            if not generic:
                generic = GenericDrug(generic_code=g_code or f"GEN-{g_name[:8].upper()}", name=g_name or g_code)
                db.add(generic)
                db.flush()

            unit_str = row.get("unit", "TABLET").strip().upper()
            try:
                unit = MedicineUnit(unit_str)
            except ValueError:
                unit = MedicineUnit.OTHER

            m = Medicine(
                medicine_code=code,
                name=name,
                generic_drug_id=generic.id,
                batch_number=row.get("batch_number", "BATCH-000").strip(),
                expiry_date=date.fromisoformat(row["expiry_date"].strip()),
                mrp=Decimal(row["mrp"].strip()),
                unit=unit,
                stock_qty=int(row.get("stock_qty", 0) or 0),
                status=row.get("status", "true").strip().lower() not in ("false", "0", "inactive"),
            )
            db.add(m)
            inserted += 1
        except Exception as e:
            errors.append(f"Row {row}: {e}")

    db.commit()
    return ImportResult(inserted=inserted, skipped=skipped, errors=errors)

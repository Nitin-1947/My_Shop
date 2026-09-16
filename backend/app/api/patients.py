"""
Patients router — GET/POST/PUT/DELETE + CSV import.
HTTP concerns only; business logic lives in engine/.
"""
from __future__ import annotations

import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Patient
from app.schemas import ImportResult, PatientCreate, PatientOut, PatientUpdate

router = APIRouter(prefix="/api/patients", tags=["Patients"])


def _get_or_404(db: Session, patient_id: int) -> Patient:
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    return p


@router.get("", response_model=list[PatientOut])
def list_patients(
    search: Optional[str] = Query(None),
    status: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Patient)
    if search:
        q = q.filter(Patient.name.ilike(f"%{search}%") | Patient.patient_code.ilike(f"%{search}%"))
    if status is not None:
        q = q.filter(Patient.status == status)
    return q.order_by(Patient.name).all()


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, patient_id)


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(body: PatientCreate, db: Session = Depends(get_db)):
    existing = db.query(Patient).filter(Patient.patient_code == body.patient_code).first()
    if existing:
        raise HTTPException(400, f"Patient code '{body.patient_code}' already exists")
    p = Patient(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(patient_id: int, body: PatientUpdate, db: Session = Depends(get_db)):
    p = _get_or_404(db, patient_id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    p = _get_or_404(db, patient_id)
    db.delete(p)
    db.commit()


@router.post("/import", response_model=ImportResult)
async def import_patients(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    CSV columns: patient_code, name, age (opt), gender (opt), phone (opt), address (opt), status (opt)
    """
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    inserted = skipped = 0
    errors: list[str] = []

    for row in reader:
        code = row.get("patient_code", "").strip()
        name = row.get("name", "").strip()
        if not code or not name:
            errors.append(f"Row missing patient_code or name: {row}")
            continue
        if db.query(Patient).filter(Patient.patient_code == code).first():
            skipped += 1
            continue
        try:
            p = Patient(
                patient_code=code,
                name=name,
                age=int(row["age"]) if row.get("age", "").strip() else None,
                phone=row.get("phone", "").strip() or None,
                address=row.get("address", "").strip() or None,
                status=row.get("status", "true").strip().lower() not in ("false", "0", "inactive"),
            )
            db.add(p)
            inserted += 1
        except Exception as e:
            errors.append(f"Row {row}: {e}")

    db.commit()
    return ImportResult(inserted=inserted, skipped=skipped, errors=errors)

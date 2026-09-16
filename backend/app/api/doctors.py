"""
Doctors router — GET/POST/PUT/DELETE + CSV import.
"""
from __future__ import annotations

import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Doctor
from app.schemas import DoctorCreate, DoctorOut, DoctorUpdate, ImportResult

router = APIRouter(prefix="/api/doctors", tags=["Doctors"])


def _get_or_404(db: Session, doc_id: int) -> Doctor:
    d = db.query(Doctor).filter(Doctor.id == doc_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return d


@router.get("", response_model=list[DoctorOut])
def list_doctors(
    search: Optional[str] = Query(None),
    status: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Doctor)
    if search:
        q = q.filter(Doctor.name.ilike(f"%{search}%") | Doctor.doctor_code.ilike(f"%{search}%"))
    if status is not None:
        q = q.filter(Doctor.status == status)
    return q.order_by(Doctor.name).all()


@router.get("/{doctor_id}", response_model=DoctorOut)
def get_doctor(doctor_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, doctor_id)


@router.post("", response_model=DoctorOut, status_code=status.HTTP_201_CREATED)
def create_doctor(body: DoctorCreate, db: Session = Depends(get_db)):
    if db.query(Doctor).filter(Doctor.doctor_code == body.doctor_code).first():
        raise HTTPException(400, f"Doctor code '{body.doctor_code}' already exists")
    d = Doctor(**body.model_dump())
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@router.put("/{doctor_id}", response_model=DoctorOut)
def update_doctor(doctor_id: int, body: DoctorUpdate, db: Session = Depends(get_db)):
    d = _get_or_404(db, doctor_id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(d, k, v)
    db.commit()
    db.refresh(d)
    return d


@router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doctor(doctor_id: int, db: Session = Depends(get_db)):
    d = _get_or_404(db, doctor_id)
    db.delete(d)
    db.commit()


@router.post("/import", response_model=ImportResult)
async def import_doctors(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    CSV columns: doctor_code, name, specialization (opt), phone (opt), status (opt)
    """
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    inserted = skipped = 0
    errors: list[str] = []

    for row in reader:
        code = row.get("doctor_code", "").strip()
        name = row.get("name", "").strip()
        if not code or not name:
            errors.append(f"Row missing doctor_code or name: {row}")
            continue
        if db.query(Doctor).filter(Doctor.doctor_code == code).first():
            skipped += 1
            continue
        try:
            d = Doctor(
                doctor_code=code,
                name=name,
                specialization=row.get("specialization", "").strip() or None,
                phone=row.get("phone", "").strip() or None,
                status=row.get("status", "true").strip().lower() not in ("false", "0", "inactive"),
            )
            db.add(d)
            inserted += 1
        except Exception as e:
            errors.append(f"Row {row}: {e}")

    db.commit()
    return ImportResult(inserted=inserted, skipped=skipped, errors=errors)

"""
Generic Drugs router — GET/POST/DELETE + CSV import.
"""
from __future__ import annotations

import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import GenericDrug
from app.schemas import GenericDrugCreate, GenericDrugOut, ImportResult

router = APIRouter(prefix="/api/generic-drugs", tags=["Generic Drugs"])


@router.get("", response_model=list[GenericDrugOut])
def list_generics(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(GenericDrug)
    if search:
        q = q.filter(GenericDrug.name.ilike(f"%{search}%") | GenericDrug.generic_code.ilike(f"%{search}%"))
    return q.order_by(GenericDrug.name).all()


@router.get("/{generic_id}", response_model=GenericDrugOut)
def get_generic(generic_id: int, db: Session = Depends(get_db)):
    g = db.query(GenericDrug).filter(GenericDrug.id == generic_id).first()
    if not g:
        raise HTTPException(404, "Generic drug not found")
    return g


@router.post("", response_model=GenericDrugOut, status_code=status.HTTP_201_CREATED)
def create_generic(body: GenericDrugCreate, db: Session = Depends(get_db)):
    if db.query(GenericDrug).filter(GenericDrug.generic_code == body.generic_code).first():
        raise HTTPException(400, f"Generic code '{body.generic_code}' already exists")
    g = GenericDrug(**body.model_dump())
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


@router.delete("/{generic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_generic(generic_id: int, db: Session = Depends(get_db)):
    g = db.query(GenericDrug).filter(GenericDrug.id == generic_id).first()
    if not g:
        raise HTTPException(404, "Generic drug not found")
    db.delete(g)
    db.commit()


@router.post("/import", response_model=ImportResult)
async def import_generics(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    CSV columns: generic_code, name
    """
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    inserted = skipped = 0
    errors: list[str] = []

    for row in reader:
        code = row.get("generic_code", "").strip()
        name = row.get("name", "").strip()
        if not code or not name:
            errors.append(f"Row missing generic_code or name: {row}")
            continue
        if db.query(GenericDrug).filter(GenericDrug.generic_code == code).first():
            skipped += 1
            continue
        try:
            db.add(GenericDrug(generic_code=code, name=name))
            inserted += 1
        except Exception as e:
            errors.append(f"Row {row}: {e}")

    db.commit()
    return ImportResult(inserted=inserted, skipped=skipped, errors=errors)

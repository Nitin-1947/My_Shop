"""
Dose Patterns router — GET/POST/DELETE with nested items.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import DosePattern, DosePatternItem, Medicine
from app.schemas import DosePatternCreate, DosePatternItemOut, DosePatternOut

router = APIRouter(prefix="/api/dose-patterns", tags=["Dose Patterns"])


def _enrich_pattern(dp: DosePattern) -> DosePatternOut:
    items_out = []
    for item in dp.items:
        med_name = item.medicine.name if item.medicine else None
        items_out.append(DosePatternItemOut(
            id=item.id,
            medicine_id=item.medicine_id,
            medicine_name=med_name,
            quantity=item.quantity,
        ))
    return DosePatternOut(
        id=dp.id,
        name=dp.name,
        illness_name=dp.illness_name,
        status=dp.status,
        created_at=dp.created_at,
        items=items_out,
    )


@router.get("", response_model=list[DosePatternOut])
def list_dose_patterns(
    search: Optional[str] = Query(None),
    status: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(DosePattern)
    if search:
        q = q.filter(DosePattern.illness_name.ilike(f"%{search}%") | DosePattern.name.ilike(f"%{search}%"))
    if status is not None:
        q = q.filter(DosePattern.status == status)
    patterns = q.order_by(DosePattern.illness_name).all()
    return [_enrich_pattern(dp) for dp in patterns]


@router.get("/{pattern_id}", response_model=DosePatternOut)
def get_dose_pattern(pattern_id: int, db: Session = Depends(get_db)):
    dp = db.query(DosePattern).filter(DosePattern.id == pattern_id).first()
    if not dp:
        raise HTTPException(404, "Dose pattern not found")
    return _enrich_pattern(dp)


@router.post("", response_model=DosePatternOut, status_code=status.HTTP_201_CREATED)
def create_dose_pattern(body: DosePatternCreate, db: Session = Depends(get_db)):
    dp = DosePattern(name=body.name, illness_name=body.illness_name, status=body.status)
    db.add(dp)
    db.flush()

    for item_in in body.items:
        med = db.query(Medicine).filter(Medicine.id == item_in.medicine_id).first()
        if not med:
            raise HTTPException(400, f"Medicine id={item_in.medicine_id} not found")
        dpi = DosePatternItem(
            dose_pattern_id=dp.id,
            medicine_id=item_in.medicine_id,
            quantity=item_in.quantity,
        )
        db.add(dpi)

    db.commit()
    db.refresh(dp)
    return _enrich_pattern(dp)


@router.put("/{pattern_id}", response_model=DosePatternOut)
def update_dose_pattern(pattern_id: int, body: DosePatternCreate, db: Session = Depends(get_db)):
    dp = db.query(DosePattern).filter(DosePattern.id == pattern_id).first()
    if not dp:
        raise HTTPException(404, "Dose pattern not found")

    dp.name = body.name
    dp.illness_name = body.illness_name
    dp.status = body.status

    # Replace all items
    for old_item in dp.items:
        db.delete(old_item)
    db.flush()

    for item_in in body.items:
        med = db.query(Medicine).filter(Medicine.id == item_in.medicine_id).first()
        if not med:
            raise HTTPException(400, f"Medicine id={item_in.medicine_id} not found")
        db.add(DosePatternItem(
            dose_pattern_id=dp.id,
            medicine_id=item_in.medicine_id,
            quantity=item_in.quantity,
        ))

    db.commit()
    db.refresh(dp)
    return _enrich_pattern(dp)


@router.delete("/{pattern_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dose_pattern(pattern_id: int, db: Session = Depends(get_db)):
    dp = db.query(DosePattern).filter(DosePattern.id == pattern_id).first()
    if not dp:
        raise HTTPException(404, "Dose pattern not found")
    db.delete(dp)
    db.commit()

"""
Random Bill Engine — Pure Python, zero FastAPI/UI imports.
Implements PRD §7, §14–15, Rules 1–20.

This module is the heart of My Shop's deterministic generation system.
It can be imported and tested directly with pytest without starting FastAPI.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.models import (
    DosePattern,
    GenericDrug,
    Medicine,
    MedicineUnit,
)


# ── Data transfer objects (not ORM models, no SQLAlchemy state) ───────────────

@dataclass
class ItemCandidate:
    """Intermediate item before persistence."""
    medicine_id: int
    medicine_name: str
    generic_drug_id: int
    generic_name: str
    batch_number: str
    expiry_date: date
    mrp: float
    unit: str
    quantity: int

    @property
    def line_total(self) -> float:
        return round(self.mrp * self.quantity, 2)


# ── Quantity heuristics by unit type (PRD §14 Rule 12) ───────────────────────

_QTY_RANGE: dict[str, tuple[int, int]] = {
    MedicineUnit.TABLET.value:   (10, 60),
    MedicineUnit.CAPSULE.value:  (10, 30),
    MedicineUnit.SYRUP.value:    (1, 3),
    MedicineUnit.INJECTION.value:(1, 5),
    MedicineUnit.CREAM.value:    (1, 2),
    MedicineUnit.DROPS.value:    (1, 3),
    MedicineUnit.INHALER.value:  (1, 2),
    MedicineUnit.SACHET.value:   (5, 20),
    MedicineUnit.OTHER.value:    (1, 10),
}


def _random_qty(unit: str, rng: random.Random) -> int:
    lo, hi = _QTY_RANGE.get(unit, (1, 10))
    return rng.randint(lo, hi)


# ── Validation pass (PRD §15 — defense-in-depth) ─────────────────────────────

class ValidationError(Exception):
    """Raised when item-level validation fails."""


def validate_items(items: list[ItemCandidate]) -> list[ItemCandidate]:
    """
    Final defense-in-depth pass applied regardless of how items were built.
    Checks:
      1. Positive quantity
      2. Medicine not expired
      3. No duplicate generic_drug_id within the list
    Returns the valid subset (silently drops invalid items).
    """
    seen_generics: set[int] = set()
    valid: list[ItemCandidate] = []

    for item in items:
        if item.quantity <= 0:
            continue
        if item.expiry_date < date.today():
            continue
        if item.generic_drug_id in seen_generics:
            continue
        seen_generics.add(item.generic_drug_id)
        valid.append(item)

    return valid


# ── Active, non-expired medicine query ───────────────────────────────────────

def _active_medicines(db: Session) -> list[Medicine]:
    """Return all active, non-expired medicines (joined with generic_drug)."""
    today = date.today()
    return (
        db.query(Medicine)
        .filter(
            Medicine.status.is_(True),
            Medicine.expiry_date > today,
        )
        .all()
    )


# ── Dose-based generation (PRD §7 / Rule 10) ─────────────────────────────────

def generate_dose_based_items(
    db: Session,
    rng: random.Random,
) -> list[ItemCandidate]:
    """
    1. Pick one random active dose pattern.
    2. Iterate its items; skip expired / inactive medicines.
    3. Deduplicate by generic_drug_id (first-seen wins).
    Returns an empty list if no usable dose pattern is found.
    """
    today = date.today()

    active_patterns = (
        db.query(DosePattern)
        .filter(DosePattern.status.is_(True))
        .all()
    )
    if not active_patterns:
        return []

    # Shuffle and try patterns until we find one with usable items
    candidates = list(active_patterns)
    rng.shuffle(candidates)

    for pattern in candidates:
        seen_generics: set[int] = set()
        items: list[ItemCandidate] = []

        for pitem in pattern.items:
            med: Medicine = pitem.medicine
            if not med.status:
                continue
            if med.expiry_date <= today:
                continue
            if med.generic_drug_id in seen_generics:
                continue
            seen_generics.add(med.generic_drug_id)
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
                    quantity=pitem.quantity,
                )
            )

        if items:
            return items

    return []


# ── Generic-based generation (PRD §7 / Rule 11–13) ───────────────────────────

def generate_generic_based_items(
    db: Session,
    rng: random.Random,
    min_items: int = 1,
    max_items: int = 5,
) -> list[ItemCandidate]:
    """
    1. Build a map: generic_drug_id → [list of eligible medicine brands].
    2. Sample 1–5 distinct generics (PRD Rule 12).
    3. For each chosen generic, pick one random brand.
    4. Assign quantity randomized by unit type (PRD Rule 13).
    Returns an empty list if medicine pool is empty.
    """
    eligible = _active_medicines(db)
    if not eligible:
        return []

    # Build generic → medicines map
    generic_map: dict[int, list[Medicine]] = {}
    for med in eligible:
        generic_map.setdefault(med.generic_drug_id, []).append(med)

    all_generic_ids = list(generic_map.keys())
    if not all_generic_ids:
        return []

    count = rng.randint(min_items, min(max_items, len(all_generic_ids)))
    chosen_generic_ids = rng.sample(all_generic_ids, count)

    items: list[ItemCandidate] = []
    for gid in chosen_generic_ids:
        med: Medicine = rng.choice(generic_map[gid])
        qty = _random_qty(med.unit.value, rng)
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

    return items

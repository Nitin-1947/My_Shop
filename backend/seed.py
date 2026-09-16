"""
seed.py — One-shot script to load sample_data/ CSVs into SQLite.
Run once after setting up the virtual environment:

    python seed.py

Safe to re-run — skips existing records (matches on unique codes).
"""
import csv
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

# Add the backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import create_tables, SessionLocal
from app.models import (
    Doctor, DosePattern, DosePatternItem, GenericDrug,
    Medicine, MedicineUnit, Patient,
)

SAMPLE_DIR = Path(__file__).parent / "sample_data"


def load_csv(filename: str) -> list[dict]:
    path = SAMPLE_DIR / filename
    if not path.exists():
        print(f"  WARN {filename} not found, skipping.")
        return []
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def seed_patients(db):
    rows = load_csv("patients.csv")
    count = 0
    for row in rows:
        if db.query(Patient).filter(Patient.patient_code == row["patient_code"].strip()).first():
            continue
        db.add(Patient(
            patient_code=row["patient_code"].strip(),
            name=row["name"].strip(),
            age=int(row["age"]) if row.get("age", "").strip() else None,
            phone=row.get("phone", "").strip() or None,
            address=row.get("address", "").strip() or None,
            status=row.get("status", "true").strip().lower() not in ("false", "0", "inactive"),
        ))
        count += 1
    db.commit()
    print(f"  OK Patients: {count} inserted, {len(rows) - count} skipped")


def seed_doctors(db):
    rows = load_csv("doctors.csv")
    count = 0
    for row in rows:
        if db.query(Doctor).filter(Doctor.doctor_code == row["doctor_code"].strip()).first():
            continue
        db.add(Doctor(
            doctor_code=row["doctor_code"].strip(),
            name=row["name"].strip(),
            specialization=row.get("specialization", "").strip() or None,
            phone=row.get("phone", "").strip() or None,
            status=row.get("status", "true").strip().lower() not in ("false", "0", "inactive"),
        ))
        count += 1
    db.commit()
    print(f"  OK Doctors:  {count} inserted, {len(rows) - count} skipped")


def seed_generic_drugs(db):
    rows = load_csv("generic_drugs.csv")
    count = 0
    for row in rows:
        if db.query(GenericDrug).filter(GenericDrug.generic_code == row["generic_code"].strip()).first():
            continue
        db.add(GenericDrug(
            generic_code=row["generic_code"].strip(),
            name=row["name"].strip(),
        ))
        count += 1
    db.commit()
    print(f"  OK Generics: {count} inserted, {len(rows) - count} skipped")


def seed_medicines(db):
    rows = load_csv("medicines.csv")
    count = 0
    for row in rows:
        if db.query(Medicine).filter(Medicine.medicine_code == row["medicine_code"].strip()).first():
            continue
        generic = db.query(GenericDrug).filter(
            GenericDrug.generic_code == row["generic_code"].strip()
        ).first()
        if not generic:
            print(f"    WARN Generic '{row['generic_code']}' not found for {row['medicine_code']}, skipping")
            continue
        unit_str = row.get("unit", "TABLET").strip().upper()
        try:
            unit = MedicineUnit(unit_str)
        except ValueError:
            unit = MedicineUnit.OTHER
        db.add(Medicine(
            medicine_code=row["medicine_code"].strip(),
            name=row["name"].strip(),
            generic_drug_id=generic.id,
            batch_number=row["batch_number"].strip(),
            expiry_date=date.fromisoformat(row["expiry_date"].strip()),
            mrp=Decimal(row["mrp"].strip()),
            unit=unit,
            stock_qty=int(row.get("stock_qty", 0) or 0),
            status=row.get("status", "true").strip().lower() not in ("false", "0", "inactive"),
        ))
        count += 1
    db.commit()
    print(f"  OK Medicines:{count} inserted, {len(rows) - count} skipped")


def seed_dose_patterns(db):
    pattern_rows = load_csv("dose_patterns.csv")
    item_rows = load_csv("dose_pattern_items.csv")

    # Build a lookup: pattern_name → DosePattern
    pattern_lookup: dict[str, DosePattern] = {}
    inserted_patterns = 0
    for row in pattern_rows:
        pname = row["pattern_name"].strip()
        existing = db.query(DosePattern).filter(DosePattern.name == pname).first()
        if existing:
            pattern_lookup[pname] = existing
            continue
        dp = DosePattern(
            name=pname,
            illness_name=row["illness_name"].strip(),
            status=row.get("status", "true").strip().lower() not in ("false", "0", "inactive"),
        )
        db.add(dp)
        db.flush()
        pattern_lookup[pname] = dp
        inserted_patterns += 1

    # Insert items
    inserted_items = 0
    for row in item_rows:
        pname = row["pattern_name"].strip()
        med_code = row["medicine_code"].strip()
        qty = int(row["quantity"].strip())

        dp = pattern_lookup.get(pname)
        if not dp:
            continue
        med = db.query(Medicine).filter(Medicine.medicine_code == med_code).first()
        if not med:
            print(f"    WARN Medicine '{med_code}' not found for pattern '{pname}', skipping item")
            continue

        # Skip if item already exists
        existing_item = db.query(DosePatternItem).filter(
            DosePatternItem.dose_pattern_id == dp.id,
            DosePatternItem.medicine_id == med.id,
        ).first()
        if existing_item:
            continue

        db.add(DosePatternItem(
            dose_pattern_id=dp.id,
            medicine_id=med.id,
            quantity=qty,
        ))
        inserted_items += 1

    db.commit()
    print(f"  OK Dose Patterns: {inserted_patterns} patterns, {inserted_items} items inserted")


def main():
    print("\nMy Shop -- Seeding database...")
    print("=" * 50)
    create_tables()
    db = SessionLocal()
    try:
        seed_patients(db)
        seed_doctors(db)
        seed_generic_drugs(db)
        seed_medicines(db)
        seed_dose_patterns(db)
        print("=" * 50)
        print("[OK] Database seeded successfully!")
        print("\nNext step: uvicorn main:app --reload --port 8000")
    finally:
        db.close()


if __name__ == "__main__":
    main()

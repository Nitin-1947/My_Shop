# My Shop — Offline Medical Shop Random Bill Generator

> **100% local · No AI/LLM · No internet required**

A deterministic, rule-based pharmacy billing tool for generating simulated bills (testing/demos) and real manual bills — built as a local FastAPI + React web app.

---

## Quick Start

```bash
# Terminal 1 — Backend
cd backend
python -m venv venv
venv\Scripts\Activate.ps1          # Windows PowerShell
pip install -r requirements.txt
python seed.py                      # Load sample data (run once)
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.
API docs at **http://localhost:8000/docs**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10+ / FastAPI |
| Database | SQLite via SQLAlchemy ORM |
| PDF | ReportLab (watermarked cash-memo template) |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Custom CSS — Clinical Precision design system |
| Random engine | Python `random` module (no ML/AI) |

---

## Architecture

```
React Frontend (localhost:5173)
        │  REST/axios
FastAPI Backend (localhost:8000)
        │
 ┌──────┼──────────────┐
 │      │              │
CRUD  Rule Engine    PDF Engine
Routers  ├─ random_engine.py   (ReportLab)
(thin)   ├─ bill_engine.py
         └─ pdf_engine.py
              │
          SQLite (backend/data/my_shop.db)
```

**Key rule:** `app/api/*.py` = HTTP only. `app/engine/*.py` = all business logic, pure Python, no FastAPI imports.

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | Stats + recent bills |
| `/patients` | Patients | CRUD + CSV import |
| `/doctors` | Doctors | CRUD + CSV import |
| `/generic-drugs` | Generic Drugs | CRUD + CSV import |
| `/medicines` | Medicines | CRUD + CSV import + expiry highlighting |
| `/dose-patterns` | Dose Patterns | Illness → medicine mappings |
| `/generate` | Random Generator | Seed/count/ratio controls + bill cards |
| `/manual-bill` | Manual Bill | Live line-item builder + PDF |
| `/bill-history` | Bill History | Filter/search + expandable rows |

---

## Bill Types

| Type | Watermark | Duplicate-Generic Check |
|---|---|---|
| **SIMULATED** | ✅ Diagonal red "SIMULATED" | ✅ Enforced |
| **MANUAL** | ❌ None | ❌ Skipped (real prescriptions can combine same-generic brands) |

---

## API Summary

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness |
| `GET/POST/PUT/DELETE` | `/api/patients` | Patient CRUD |
| `POST` | `/api/patients/import` | CSV import |
| `GET/POST/PUT/DELETE` | `/api/doctors` | Doctor CRUD |
| `GET/POST/DELETE` | `/api/generic-drugs` | Generic drug CRUD |
| `GET/POST/PUT/DELETE` | `/api/medicines` | Medicine CRUD |
| `GET/POST/DELETE` | `/api/dose-patterns` | Dose pattern CRUD |
| `POST` | `/api/generation/random` | Generate N simulated bills |
| `GET` | `/api/bills` | Bill history (filterable) |
| `GET` | `/api/bills/{id}/pdf` | Stream PDF |
| `POST` | `/api/bills/manual` | Create manual bill |
| `GET` | `/api/bills/stats` | Dashboard statistics |

Full interactive docs: **http://localhost:8000/docs**

---

## Reproducible Generation

```json
POST /api/generation/random
{ "count": 10, "seed": 42, "dose_ratio": 0.5 }
```

Same `seed` + same database data → identical bill sequence every time. Useful for regression tests.

---

## Sample Data

`backend/sample_data/` contains:
- **20 patients**, **10 doctors**, **30 generic drugs**, **50 medicines**, **10 dose patterns**

Run `python seed.py` to load them into SQLite. Safe to re-run (skips existing records).

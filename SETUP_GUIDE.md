# Setup Guide — My Shop (Windows / VS Code)

## Prerequisites

- Python 3.10 or newer: https://www.python.org/downloads/
- Node.js 18 or newer: https://nodejs.org/
- VS Code (recommended): https://code.visualstudio.com/

---

## Step 1 — Open the project in VS Code

Open `d:\My_Shop` as your workspace folder.

---

## Step 2 — Backend setup

Open a **new terminal** in VS Code (Ctrl+\`).

```powershell
cd backend

# Create a virtual environment
python -m venv venv

# Activate it (PowerShell)
venv\Scripts\Activate.ps1
```

> **If you get an execution policy error**, run this once and then retry:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

```powershell
# Install dependencies
pip install -r requirements.txt

# Seed the database with sample data
python seed.py
```

You should see output like:
```
✓ Patients: 20 inserted, 0 skipped
✓ Doctors:  10 inserted, 0 skipped
✓ Generics: 30 inserted, 0 skipped
✓ Medicines:50 inserted, 0 skipped
✓ Dose Patterns: 10 patterns, 28 items inserted
✅ Database seeded successfully!
```

```powershell
# Start the backend server
uvicorn main:app --reload --port 8000
```

Leave this terminal running. Backend is live at http://localhost:8000
API docs at http://localhost:8000/docs

---

## Step 3 — Frontend setup

Open a **second terminal** in VS Code (click the `+` icon in the terminal panel).

```powershell
cd frontend
npm install
npm run dev
```

Frontend is live at http://localhost:5173

---

## Step 4 — Open the app

Navigate to **http://localhost:5173** in your browser.

You should see the Dashboard. Try:
1. **Random Generator** → Generate 5 bills → Download a PDF
2. **Bill History** → filter by SIMULATED
3. **Manual Bill** → create a prescription bill

---

## Day-to-day

| Task | Command |
|---|---|
| Start backend | `cd backend && venv\Scripts\Activate.ps1 && uvicorn main:app --reload --port 8000` |
| Start frontend | `cd frontend && npm run dev` |
| Re-seed data | `cd backend && python seed.py` (safe to re-run) |
| Reset database | Delete `backend\data\my_shop.db` then re-run `seed.py` |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `uvicorn: command not found` | Make sure venv is activated (`venv\Scripts\Activate.ps1`) |
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` again |
| Frontend shows "Could not connect" | Make sure backend is running on port 8000 |
| CSV import fails | Check that column names match the sample CSVs in `backend/sample_data/` |
| `0 bills generated` | Run `python seed.py` first; generation needs active patients, doctors, and non-expired medicines |

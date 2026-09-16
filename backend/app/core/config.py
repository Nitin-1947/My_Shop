"""
My Shop — Panchvati Medical Store
App configuration and shop branding constants.
"""
from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/


class Settings(BaseSettings):
    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "My Shop"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # ── Shop Branding (used in PDF headers) ──────────────────────────────────
    SHOP_NAME: str = "Panchvati Medical Store"
    SHOP_TAGLINE: str = "Your Trusted Neighbourhood Pharmacy"
    SHOP_OWNER: str = "Proprietor: Ramesh Patel"
    SHOP_ADDRESS_LINE1: str = "12, Panchvati Market, Station Road"
    SHOP_ADDRESS_LINE2: str = "Ahmedabad, Gujarat — 380 001"
    SHOP_PHONE: str = "Ph: +91 79 2222 3333  |  Mob: +91 98765 43210"
    SHOP_EMAIL: str = "panchvati.medical@gmail.com"
    SHOP_GSTIN: str = "GSTIN: 24AABCP1234A1Z5"
    SHOP_DL_NUMBER: str = "Drug Lic.: GJ-ADL-2023-0042"

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/data/my_shop.db"

    # ── PDF Storage ───────────────────────────────────────────────────────────
    PDF_DIR: Path = BASE_DIR / "generated_pdfs"

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # ── Bill Engine ───────────────────────────────────────────────────────────
    DEFAULT_DOSE_RATIO: float = 0.5       # 50/50 dose vs generic split
    MAX_GENERIC_ITEMS: int = 5            # max distinct generics in generic mode
    MIN_GENERIC_ITEMS: int = 1
    BILL_HISTORY_LIMIT: int = 500         # hard cap on history queries

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

# Ensure directories exist at import time
(BASE_DIR / "data").mkdir(parents=True, exist_ok=True)
settings.PDF_DIR.mkdir(parents=True, exist_ok=True)

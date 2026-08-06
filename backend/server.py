from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional, Literal, Any

import asyncpg
import bcrypt
import jwt
import pandas as pd
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
TAX_RATE = float(os.environ.get("TAX_RATE", "0.05"))
POINTS_PER_RUPEE = float(os.environ.get("POINTS_PER_RUPEE", "0.1"))
MIN_ORDER_FOR_POINTS = float(os.environ.get("MIN_ORDER_FOR_POINTS", "100"))
SUPABASE_DB_URL = os.environ.get("SUPABASE_DB_POOLER_URL") or os.environ["SUPABASE_DB_URL"]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("carolina_lounge")

app = FastAPI(title="# CAROLINA Lounge API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(subject: str, role: str, hours: int = 24 * 7) -> str:
    payload = {
        "sub": subject,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=hours),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


def _serialize_value(v: Any):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, datetime):
        return v.astimezone(timezone.utc).isoformat()
    if isinstance(v, list):
        return [_serialize_value(x) for x in v]
    if isinstance(v, dict):
        return {k: _serialize_value(x) for k, x in v.items()}
    return v


def row_to_dict(row: Optional[asyncpg.Record]) -> Optional[dict]:
    if not row:
        return None
    return {k: _serialize_value(v) for k, v in dict(row).items()}


def rows_to_dicts(rows: List[asyncpg.Record]) -> List[dict]:
    return [row_to_dict(r) for r in rows if r is not None]


async def db_pool() -> asyncpg.Pool:
    pool = getattr(app.state, "pool", None)
    if pool is None:
        raise HTTPException(500, "Database not initialized")
    return pool


async def require_admin(
    cred: HTTPAuthorizationCredentials = Depends(security),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    if not cred:
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(cred.credentials)
    if payload.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    row = await pool.fetchrow(
        "SELECT id, name, email, role, created_at, updated_at FROM admins WHERE id=$1",
        payload["sub"],
    )
    admin = row_to_dict(row)
    if not admin:
        raise HTTPException(401, "Admin not found")
    return admin


async def require_customer(
    cred: HTTPAuthorizationCredentials = Depends(security),
    pool: asyncpg.Pool = Depends(db_pool),
) -> dict:
    if not cred:
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(cred.credentials)
    if payload.get("role") != "customer":
        raise HTTPException(403, "Customer only")
    row = await pool.fetchrow(
        """
        SELECT id, name, mobile_number, total_points, created_at, updated_at
        FROM customers WHERE id=$1
        """,
        payload["sub"],
    )
    customer = row_to_dict(row)
    if not customer:
        raise HTTPException(401, "Customer not found")
    return customer


async def optional_customer(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(security),
    pool: asyncpg.Pool = Depends(db_pool),
) -> Optional[dict]:
    if not cred:
        return None
    try:
        payload = decode_token(cred.credentials)
        if payload.get("role") != "customer":
            return None
        row = await pool.fetchrow(
            "SELECT id, name, mobile_number, total_points FROM customers WHERE id=$1",
            payload["sub"],
        )
        return row_to_dict(row)
    except Exception:
        return None


class AdminLogin(BaseModel):
    email: str
    password: str


class CustomerRegister(BaseModel):
    name: str
    mobile_number: str
    password: str


class CustomerLogin(BaseModel):
    mobile_number: str
    password: str


class CategoryIn(BaseModel):
    name: str
    is_active: bool = True


class MenuItemIn(BaseModel):
    category_id: str
    name: str
    description: str = ""
    price: float
    image_url: str = ""
    is_available: bool = True


class OrderItemIn(BaseModel):
    menu_item_id: str
    quantity: int


class OrderIn(BaseModel):
    customer_name: str
    mobile_number: str
    table_number: str
    items: List[OrderItemIn]
    reward_id: Optional[str] = None


class StatusUpdate(BaseModel):
    status: Literal[
        "order_placed",
        "accepted",
        "preparing",
        "ready",
        "served",
        "completed",
        "rejected",
        "cancelled",
    ]


class RewardIn(BaseModel):
    reward_name: str
    description: str = ""
    points_required: int
    reward_type: Literal["free_item", "discount"] = "free_item"
    menu_item_id: Optional[str] = None
    discount_amount: float = 0
class SQLitePool:
    def __init__(self, db_path="carolina_lounge.db"):
        import sqlite3
        self.db_path = str(ROOT_DIR / db_path)
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row

    def _prep_query(self, query: str, args: tuple):
        q = re.sub(r'\$\d+', '?', query)
        q = re.sub(r'TIMESTAMPTZ', 'TEXT', q, flags=re.IGNORECASE)
        q = re.sub(r'JSONB', 'TEXT', q, flags=re.IGNORECASE)
        q = re.sub(r'NUMERIC\(12,2\)', 'REAL', q, flags=re.IGNORECASE)
        q = re.sub(r'order_status = ANY\(\$1::text\[\]\)', 'order_status IN (?, ?, ?, ?)', q, flags=re.IGNORECASE)
        q = re.sub(r'ON CONFLICT\([^)]+\)\s*DO UPDATE SET', 'ON CONFLICT DO UPDATE SET', q, flags=re.IGNORECASE)
        
        flat = []
        for a in args:
            if isinstance(a, (dict, list)):
                flat.append(json.dumps(a))
            elif isinstance(a, datetime):
                flat.append(a.isoformat())
            else:
                flat.append(a)
        return q, flat

    async def execute(self, query: str, *args):
        if "TRUNCATE TABLE" in query:
            cur = self.conn.cursor()
            for tbl in ["redemptions", "loyalty_transactions", "orders", "rewards", "menu_items", "categories", "customers", "admins"]:
                try: cur.execute(f"DELETE FROM {tbl}")
                except Exception: pass
            self.conn.commit()
            return "OK"
        q, flat = self._prep_query(query, args)
        cur = self.conn.cursor()
        if not flat and ";" in q:
            cur.executescript(q)
        else:
            cur.execute(q, flat)
        self.conn.commit()
        return "OK"

    async def executemany(self, query: str, seq_of_args):
        cur = self.conn.cursor()
        for args in seq_of_args:
            q, flat = self._prep_query(query, args)
            cur.execute(q, flat)
        self.conn.commit()
        return "OK"

    async def fetch(self, query: str, *args):
        q, flat = self._prep_query(query, args)
        cur = self.conn.cursor()
        cur.execute(q, flat)
        rows = cur.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            if "items" in d and isinstance(d["items"], str):
                try: d["items"] = json.loads(d["items"])
                except Exception: pass
            result.append(d)
        return result

    async def fetchrow(self, query: str, *args):
        rows = await self.fetch(query, *args)
        return rows[0] if rows else None

    async def fetchval(self, query: str, *args):
        row = await self.fetchrow(query, *args)
        if row:
            return list(row.values())[0]
        return None

    def acquire(self):
        ctx = self
        class ContextManager:
            async def __aenter__(self):
                return ctx
            async def __aexit__(self, exc_type, exc, tb):
                pass
        return ContextManager()

    async def close(self):
        self.conn.close()


async def ensure_schema(pool):
    async with pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS admins (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'admin',
                created_at TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ
            );

            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                mobile_number TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                total_points INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ
            );

            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL
            );

            CREATE TABLE IF NOT EXISTS menu_items (
                id TEXT PRIMARY KEY,
                category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                price NUMERIC(12,2) NOT NULL,
                image_url TEXT NOT NULL DEFAULT '',
                is_available BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL
            );

            CREATE TABLE IF NOT EXISTS rewards (
                id TEXT PRIMARY KEY,
                reward_name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                points_required INTEGER NOT NULL,
                reward_type TEXT NOT NULL,
                menu_item_id TEXT,
                discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL
            );

            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                order_number TEXT NOT NULL UNIQUE,
                customer_id TEXT,
                customer_name TEXT NOT NULL,
                mobile_number TEXT NOT NULL,
                table_number TEXT NOT NULL,
                subtotal NUMERIC(12,2) NOT NULL,
                tax_amount NUMERIC(12,2) NOT NULL,
                discount_amount NUMERIC(12,2) NOT NULL,
                total_amount NUMERIC(12,2) NOT NULL,
                order_status TEXT NOT NULL,
                points_earned INTEGER NOT NULL DEFAULT 0,
                points_redeemed INTEGER NOT NULL DEFAULT 0,
                reward_id TEXT,
                reward_name TEXT,
                items JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL
            );

            CREATE TABLE IF NOT EXISTS loyalty_transactions (
                id TEXT PRIMARY KEY,
                customer_id TEXT NOT NULL,
                order_id TEXT,
                transaction_type TEXT NOT NULL,
                points INTEGER NOT NULL,
                description TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL
            );

            CREATE TABLE IF NOT EXISTS redemptions (
                id TEXT PRIMARY KEY,
                customer_id TEXT NOT NULL,
                reward_id TEXT NOT NULL,
                reward_name TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
            CREATE INDEX IF NOT EXISTS idx_orders_mobile ON orders(mobile_number);
            """
        )


async def wipe_all_data(pool: asyncpg.Pool):
    async with pool.acquire() as conn:
        await conn.execute(
            """
            TRUNCATE TABLE
              redemptions,
              loyalty_transactions,
              orders,
              rewards,
              menu_items,
              categories,
              customers,
              admins
            RESTART IDENTITY;
            """
        )
    logger.info("Wiped all existing data from Supabase tables")


def _normalize_column(value: str) -> str:
    return "".join(ch for ch in str(value).lower().strip() if ch.isalnum())


def _pick_column(columns: List[str], aliases: List[str]) -> Optional[str]:
    normalized = {_normalize_column(c): c for c in columns}
    for alias in aliases:
        key = _normalize_column(alias)
        if key in normalized:
            return normalized[key]
    return None


def _to_available(value) -> bool:
    if value is None:
        return True
    text = str(value).strip().lower()
    if text == "":
        return True
    return text in {"1", "true", "yes", "y", "available", "active", "in stock", "instock"}


async def import_menu_from_excel(pool: asyncpg.Pool):
    configured = os.environ.get("MENU_XLSX_PATH", "").strip()
    candidates = []
    if configured:
        candidates.append(Path(configured))
    candidates.extend([
        ROOT_DIR / "CAROLINA Lounge.xlsx",
        ROOT_DIR.parent / "CAROLINA Lounge.xlsx",
        Path("C:/Users/Asus/Documents/CAROLINA Lounge.xlsx"),
    ])

    excel_path = next((p for p in candidates if p.exists() and p.is_file()), None)
    if not excel_path:
        logger.warning("Menu Excel file not found")
        return

    df = pd.read_excel(excel_path)
    if df.empty:
        logger.warning("Menu Excel file is empty: %s", excel_path)
        return

    if 'category' in df.columns:
        df['category'] = df['category'].ffill()

    categories_by_name: dict[str, str] = {}
    category_docs = []
    item_docs = []
    now = now_utc()

    for idx, row in df.iterrows():
        if idx == 0 and "price" in str(row.get("price")).lower():
            continue  # header description row (veg / non-veg / plain / butter)

        cat_val = row.get("category")
        name_val = row.get("Item Name ") or row.get("Item Name") or row.get("name")
        ing_val = row.get("ingredians") or row.get("description") or ""

        if pd.isna(name_val) or not str(name_val).strip() or str(name_val).strip().lower() == "nan":
            continue

        cat_name = str(cat_val).strip() if pd.notna(cat_val) else "General"
        item_base_name = str(name_val).strip()
        description = str(ing_val).strip() if pd.notna(ing_val) and str(ing_val).strip().lower() != "nan" else ""

        veg_price = row.get("price")
        nonveg_price = row.get("Unnamed: 4")
        plain_price = row.get("only for bread")
        butter_price = row.get("Unnamed: 6")

        def _clean_price(val):
            try:
                if pd.notna(val):
                    f = float(val)
                    if f > 0: return f
            except Exception: pass
            return None

        p_veg = _clean_price(veg_price)
        p_nonveg = _clean_price(nonveg_price)
        p_plain = _clean_price(plain_price)
        p_butter = _clean_price(butter_price)

        row_items = []
        if p_veg is not None and p_nonveg is not None:
            row_items.append((f"{item_base_name} (Veg)", p_veg))
            row_items.append((f"{item_base_name} (Non-Veg)", p_nonveg))
        elif p_veg is not None:
            row_items.append((item_base_name, p_veg))
        elif p_nonveg is not None:
            row_items.append((f"{item_base_name} (Non-Veg)", p_nonveg))
        elif p_plain is not None and p_butter is not None:
            clean_b = item_base_name.replace("(Plain/Butter)", "").strip()
            row_items.append((f"{clean_b} (Plain)", p_plain))
            row_items.append((f"{clean_b} (Butter)", p_butter))
        elif p_plain is not None:
            row_items.append((item_base_name, p_plain))
        elif p_butter is not None:
            row_items.append((item_base_name, p_butter))

        for name, price in row_items:
            if cat_name not in categories_by_name:
                cid = str(uuid.uuid4())
                categories_by_name[cat_name] = cid
                category_docs.append((cid, cat_name, True, now))

            item_docs.append(
                (
                    str(uuid.uuid4()),
                    categories_by_name[cat_name],
                    name,
                    description,
                    round(price, 2),
                    "",
                    True,
                    now,
                    now,
                )
            )

    if not category_docs or not item_docs:
        logger.warning("No valid menu rows parsed from Excel: %s", excel_path)
        return

    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM menu_items")
        await conn.execute("DELETE FROM categories")
        await conn.executemany(
            "INSERT INTO categories(id, name, is_active, created_at) VALUES($1, $2, $3, $4)",
            category_docs,
        )
        await conn.executemany(
            """
            INSERT INTO menu_items(id, category_id, name, description, price, image_url, is_available, created_at, updated_at)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            item_docs,
        )
    logger.info("Successfully imported %s menu items across %s categories into database from %s", len(item_docs), len(category_docs), excel_path)


async def seed_startup(pool: asyncpg.Pool):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@carolinalounge.com").lower().strip()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "carolina123")

    now = now_utc()
    await pool.execute(
        """
        INSERT INTO admins(id, name, email, password_hash, role, created_at, updated_at)
        VALUES($1, $2, $3, $4, 'admin', $5, $6)
        ON CONFLICT(email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at
        """,
        str(uuid.uuid4()),
        "Cafe Owner",
        admin_email,
        hash_pw(admin_pw),
        now,
        now,
    )
    logger.info("Ensured admin user: %s", admin_email)

    await import_menu_from_excel(pool)

    rewards_count = await pool.fetchval("SELECT COUNT(*) FROM rewards")
    if rewards_count == 0:
        rewards = [
            (str(uuid.uuid4()), "Free Cold Coffee", "Redeem a chilled cold coffee", 100, "free_item", None, 0.0, True, now),
            (str(uuid.uuid4()), "Free French Fries", "Crispy golden fries", 150, "free_item", None, 0.0, True, now),
            (str(uuid.uuid4()), "₹200 Off Order", "Flat ₹200 discount", 500, "discount", None, 200.0, True, now),
        ]
        await pool.executemany(
            """
            INSERT INTO rewards(id, reward_name, description, points_required, reward_type, menu_item_id, discount_amount, is_active, created_at)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
            """,
            rewards,
        )


@api_router.post("/auth/admin/login")
async def admin_login(body: AdminLogin, pool: asyncpg.Pool = Depends(db_pool)):
    admin = await pool.fetchrow("SELECT * FROM admins WHERE email=$1", body.email.lower().strip())
    if not admin or not verify_pw(body.password, admin["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = make_token(admin["id"], "admin")
    return {
        "token": token,
        "user": {"id": admin["id"], "name": admin["name"], "email": admin["email"], "role": "admin"},
    }


async def _backfill_guest_orders(pool: asyncpg.Pool, customer_id: str, mobile: str):
    await pool.execute(
        "UPDATE orders SET customer_id=$1, updated_at=$2 WHERE mobile_number=$3 AND customer_id IS NULL",
        customer_id,
        now_utc(),
        mobile,
    )


@api_router.post("/auth/customer/register")
async def customer_register(body: CustomerRegister, pool: asyncpg.Pool = Depends(db_pool)):
    mobile = body.mobile_number.strip()
    if len(mobile) < 8:
        raise HTTPException(400, "Invalid mobile number")

    existing = await pool.fetchrow("SELECT id FROM customers WHERE mobile_number=$1", mobile)
    if existing:
        raise HTTPException(400, "Mobile number already registered")

    cid = str(uuid.uuid4())
    now = now_utc()
    await pool.execute(
        """
        INSERT INTO customers(id, name, mobile_number, password_hash, total_points, created_at, updated_at)
        VALUES($1, $2, $3, $4, 0, $5, $6)
        """,
        cid,
        body.name.strip(),
        mobile,
        hash_pw(body.password),
        now,
        now,
    )
    await _backfill_guest_orders(pool, cid, mobile)
    token = make_token(cid, "customer")
    return {
        "token": token,
        "user": {"id": cid, "name": body.name.strip(), "mobile_number": mobile, "total_points": 0},
    }


@api_router.post("/auth/customer/login")
async def customer_login(body: CustomerLogin, pool: asyncpg.Pool = Depends(db_pool)):
    mobile = body.mobile_number.strip()
    c = await pool.fetchrow("SELECT * FROM customers WHERE mobile_number=$1", mobile)
    if not c or not verify_pw(body.password, c["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    await _backfill_guest_orders(pool, c["id"], mobile)
    token = make_token(c["id"], "customer")
    return {
        "token": token,
        "user": {
            "id": c["id"],
            "name": c["name"],
            "mobile_number": c["mobile_number"],
            "total_points": c["total_points"],
        },
    }


@api_router.get("/customers")
async def list_customers(admin: dict = Depends(require_admin), pool: asyncpg.Pool = Depends(db_pool)):
    rows = await pool.fetch(
        """
        SELECT c.id, c.name, c.mobile_number, c.total_points, c.created_at, c.updated_at,
               COALESCE(o.orders_count, 0) AS orders_count
        FROM customers c
        LEFT JOIN (
            SELECT customer_id, COUNT(*) AS orders_count
            FROM orders
            WHERE customer_id IS NOT NULL
            GROUP BY customer_id
        ) o ON o.customer_id = c.id
        ORDER BY c.created_at DESC
        """
    )
    return rows_to_dicts(rows)


@api_router.get("/customers/{cid}/orders")
async def customer_admin_orders(cid: str, admin: dict = Depends(require_admin), pool: asyncpg.Pool = Depends(db_pool)):
    rows = await pool.fetch("SELECT * FROM orders WHERE customer_id=$1 ORDER BY created_at DESC", cid)
    return rows_to_dicts(rows)


@api_router.get("/auth/me")
async def get_admin_me(admin: dict = Depends(require_admin)):
    return {"user": admin, "role": "admin"}


@api_router.get("/auth/customer/me")
async def get_customer_me(c: dict = Depends(require_customer)):
    return {
        "user": {
            "id": c["id"],
            "name": c["name"],
            "mobile_number": c["mobile_number"],
            "total_points": c.get("total_points", 0),
        }
    }


@api_router.get("/categories")
async def list_categories(pool: asyncpg.Pool = Depends(db_pool)):
    rows = await pool.fetch("SELECT * FROM categories ORDER BY name ASC")
    return rows_to_dicts(rows)


@api_router.post("/categories")
async def create_category(body: CategoryIn, admin: dict = Depends(require_admin), pool: asyncpg.Pool = Depends(db_pool)):
    cid = str(uuid.uuid4())
    now = now_utc()
    await pool.execute(
        "INSERT INTO categories(id, name, is_active, created_at) VALUES($1, $2, $3, $4)",
        cid,
        body.name.strip(),
        body.is_active,
        now,
    )
    row = await pool.fetchrow("SELECT * FROM categories WHERE id=$1", cid)
    return row_to_dict(row)


@api_router.delete("/categories/{cid}")
async def delete_category(cid: str, admin: dict = Depends(require_admin), pool: asyncpg.Pool = Depends(db_pool)):
    await pool.execute("DELETE FROM categories WHERE id=$1", cid)
    return {"ok": True}


@api_router.get("/menu")
async def get_menu(only_available: bool = False, pool: asyncpg.Pool = Depends(db_pool)):
    if only_available:
        items = await pool.fetch("SELECT * FROM menu_items WHERE is_available=TRUE")
    else:
        items = await pool.fetch("SELECT * FROM menu_items")
    cats = await pool.fetch("SELECT * FROM categories ORDER BY name ASC")
    return {"items": rows_to_dicts(items), "categories": rows_to_dicts(cats)}


@api_router.post("/menu")
async def create_menu_item(body: MenuItemIn, admin: dict = Depends(require_admin), pool: asyncpg.Pool = Depends(db_pool)):
    mid = str(uuid.uuid4())
    now = now_utc()
    await pool.execute(
        """
        INSERT INTO menu_items(id, category_id, name, description, price, image_url, is_available, created_at, updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        """,
        mid,
        body.category_id,
        body.name.strip(),
        body.description,
        float(body.price),
        body.image_url,
        body.is_available,
        now,
        now,
    )
    row = await pool.fetchrow("SELECT * FROM menu_items WHERE id=$1", mid)
    return row_to_dict(row)


@api_router.put("/menu/{mid}")
async def update_menu_item(mid: str, body: MenuItemIn, admin: dict = Depends(require_admin), pool: asyncpg.Pool = Depends(db_pool)):
    status = await pool.execute(
        """
        UPDATE menu_items
        SET category_id=$1, name=$2, description=$3, price=$4, image_url=$5, is_available=$6, updated_at=$7
        WHERE id=$8
        """,
        body.category_id,
        body.name.strip(),
        body.description,
        float(body.price),
        body.image_url,
        body.is_available,
        now_utc(),
        mid,
    )
    if status.endswith("0"):
        raise HTTPException(404, "Not found")
    row = await pool.fetchrow("SELECT * FROM menu_items WHERE id=$1", mid)
    return row_to_dict(row)


@api_router.patch("/menu/{mid}/availability")
async def toggle_availability(
    mid: str,
    is_available: bool,
    admin: dict = Depends(require_admin),
    pool: asyncpg.Pool = Depends(db_pool),
):
    await pool.execute(
        "UPDATE menu_items SET is_available=$1, updated_at=$2 WHERE id=$3",
        is_available,
        now_utc(),
        mid,
    )
    row = await pool.fetchrow("SELECT * FROM menu_items WHERE id=$1", mid)
    return row_to_dict(row)


@api_router.delete("/menu/{mid}")
async def delete_menu_item(mid: str, admin: dict = Depends(require_admin), pool: asyncpg.Pool = Depends(db_pool)):
    await pool.execute("DELETE FROM menu_items WHERE id=$1", mid)
    return {"ok": True}


@api_router.get("/rewards")
async def list_rewards(active_only: bool = False, pool: asyncpg.Pool = Depends(db_pool)):
    if active_only:
        rows = await pool.fetch("SELECT * FROM rewards WHERE is_active=TRUE")
    else:
        rows = await pool.fetch("SELECT * FROM rewards")
    return rows_to_dicts(rows)


@api_router.post("/rewards")
async def create_reward(body: RewardIn, admin: dict = Depends(require_admin), pool: asyncpg.Pool = Depends(db_pool)):
    rid = str(uuid.uuid4())
    await pool.execute(
        """
        INSERT INTO rewards(id, reward_name, description, points_required, reward_type, menu_item_id, discount_amount, is_active, created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        """,
        rid,
        body.reward_name,
        body.description,
        body.points_required,
        body.reward_type,
        body.menu_item_id,
        float(body.discount_amount),
        body.is_active,
        now_utc(),
    )
    row = await pool.fetchrow("SELECT * FROM rewards WHERE id=$1", rid)
    return row_to_dict(row)


@api_router.put("/rewards/{rid}")
async def update_reward(rid: str, body: RewardIn, admin: dict = Depends(require_admin), pool: asyncpg.Pool = Depends(db_pool)):
    status = await pool.execute(
        """
        UPDATE rewards
        SET reward_name=$1, description=$2, points_required=$3, reward_type=$4, menu_item_id=$5, discount_amount=$6, is_active=$7
        WHERE id=$8
        """,
        body.reward_name,
        body.description,
        body.points_required,
        body.reward_type,
        body.menu_item_id,
        float(body.discount_amount),
        body.is_active,
        rid,
    )
    if status.endswith("0"):
        raise HTTPException(404, "Not found")
    row = await pool.fetchrow("SELECT * FROM rewards WHERE id=$1", rid)
    return row_to_dict(row)


@api_router.delete("/rewards/{rid}")
async def delete_reward(rid: str, admin: dict = Depends(require_admin), pool: asyncpg.Pool = Depends(db_pool)):
    await pool.execute("DELETE FROM rewards WHERE id=$1", rid)
    return {"ok": True}


@api_router.post("/rewards/{rid}/redeem")
async def redeem_reward(rid: str, c: dict = Depends(require_customer), pool: asyncpg.Pool = Depends(db_pool)):
    reward = await pool.fetchrow("SELECT * FROM rewards WHERE id=$1 AND is_active=TRUE", rid)
    if not reward:
        raise HTTPException(404, "Reward not found")
    if c.get("total_points", 0) < reward["points_required"]:
        raise HTTPException(400, "Insufficient points")

    new_points = int(c["total_points"]) - int(reward["points_required"])
    await pool.execute(
        "UPDATE customers SET total_points=$1, updated_at=$2 WHERE id=$3",
        new_points,
        now_utc(),
        c["id"],
    )

    await pool.execute(
        """
        INSERT INTO loyalty_transactions(id, customer_id, order_id, transaction_type, points, description, created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7)
        """,
        str(uuid.uuid4()),
        c["id"],
        None,
        "redeemed",
        -int(reward["points_required"]),
        f"Redeemed: {reward['reward_name']}",
        now_utc(),
    )

    redemption = {
        "id": str(uuid.uuid4()),
        "customer_id": c["id"],
        "reward_id": rid,
        "reward_name": reward["reward_name"],
        "status": "issued",
        "created_at": now_utc().isoformat(),
    }
    await pool.execute(
        """
        INSERT INTO redemptions(id, customer_id, reward_id, reward_name, status, created_at)
        VALUES($1,$2,$3,$4,$5,$6)
        """,
        redemption["id"],
        redemption["customer_id"],
        redemption["reward_id"],
        redemption["reward_name"],
        redemption["status"],
        now_utc(),
    )
    return {"redemption": redemption, "new_balance": new_points}


async def _generate_order_number(pool: asyncpg.Pool) -> str:
    count = await pool.fetchval("SELECT COUNT(*) FROM orders")
    return f"ORD{1000 + int(count) + 1}"


@api_router.post("/orders")
async def create_order(
    body: OrderIn,
    current: Optional[dict] = Depends(optional_customer),
    pool: asyncpg.Pool = Depends(db_pool),
):
    if not body.items:
        raise HTTPException(400, "Cart is empty")
    if not body.customer_name.strip() or not body.mobile_number.strip() or not body.table_number.strip():
        raise HTTPException(400, "Missing required fields")

    subtotal = 0.0
    order_items = []
    for it in body.items:
        mi = await pool.fetchrow("SELECT * FROM menu_items WHERE id=$1", it.menu_item_id)
        if not mi:
            # Fallback lookup by ID string or name match if item ID was refreshed
            mi = await pool.fetchrow("SELECT * FROM menu_items WHERE lower(name) = lower($1)", it.menu_item_id)
        if not mi:
            raise HTTPException(400, "One of the items in your cart is no longer in the menu. Please clear your cart and re-add items.")
        if not mi["is_available"]:
            raise HTTPException(400, f"Item unavailable: {mi['name']}")
        line = float(mi["price"]) * int(it.quantity)
        subtotal += line
        order_items.append(
            {
                "id": str(uuid.uuid4()),
                "menu_item_id": mi["id"],
                "item_name": mi["name"],
                "item_price": float(mi["price"]),
                "quantity": int(it.quantity),
                "item_total": line,
            }
        )

    reward_discount = 0.0
    reward_applied = None
    if body.reward_id and current:
        reward = await pool.fetchrow("SELECT * FROM rewards WHERE id=$1 AND is_active=TRUE", body.reward_id)
        if not reward:
            raise HTTPException(400, "Invalid reward")
        if current.get("total_points", 0) < reward["points_required"]:
            raise HTTPException(400, "Insufficient points")
        if reward["reward_type"] == "discount":
            reward_discount = float(reward.get("discount_amount", 0))
        reward_applied = reward

    tax = round(subtotal * TAX_RATE, 2)
    total = round(max(0, subtotal + tax - reward_discount), 2)

    onum = await _generate_order_number(pool)
    oid = str(uuid.uuid4())
    now = now_utc()
    order = {
        "id": oid,
        "order_number": onum,
        "customer_id": current["id"] if current else None,
        "customer_name": body.customer_name.strip(),
        "mobile_number": body.mobile_number.strip(),
        "table_number": body.table_number.strip(),
        "subtotal": round(subtotal, 2),
        "tax_amount": tax,
        "discount_amount": reward_discount,
        "total_amount": total,
        "order_status": "order_placed",
        "points_earned": 0,
        "points_redeemed": reward_applied["points_required"] if reward_applied else 0,
        "reward_id": body.reward_id if reward_applied else None,
        "reward_name": reward_applied["reward_name"] if reward_applied else None,
        "items": order_items,
        "created_at": now,
        "updated_at": now,
    }

    await pool.execute(
        """
        INSERT INTO orders(id, order_number, customer_id, customer_name, mobile_number, table_number, subtotal, tax_amount, discount_amount, total_amount,
                           order_status, points_earned, points_redeemed, reward_id, reward_name, items, created_at, updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18)
        """,
        order["id"],
        order["order_number"],
        order["customer_id"],
        order["customer_name"],
        order["mobile_number"],
        order["table_number"],
        order["subtotal"],
        order["tax_amount"],
        order["discount_amount"],
        order["total_amount"],
        order["order_status"],
        order["points_earned"],
        order["points_redeemed"],
        order["reward_id"],
        order["reward_name"],
        json.dumps(order["items"]),
        order["created_at"],
        order["updated_at"],
    )

    if reward_applied:
        await pool.execute(
            "UPDATE customers SET total_points = total_points - $1, updated_at=$2 WHERE id=$3",
            int(reward_applied["points_required"]),
            now,
            current["id"],
        )
        await pool.execute(
            """
            INSERT INTO loyalty_transactions(id, customer_id, order_id, transaction_type, points, description, created_at)
            VALUES($1,$2,$3,$4,$5,$6,$7)
            """,
            str(uuid.uuid4()),
            current["id"],
            oid,
            "redeemed",
            -int(reward_applied["points_required"]),
            f"Redeemed on order {onum}",
            now,
        )

    out = order.copy()
    out["created_at"] = out["created_at"].isoformat()
    out["updated_at"] = out["updated_at"].isoformat()
    return out


@api_router.get("/orders/{oid}")
async def get_order(oid: str, pool: asyncpg.Pool = Depends(db_pool)):
    row = await pool.fetchrow("SELECT * FROM orders WHERE id=$1", oid)
    o = row_to_dict(row)
    if not o:
        raise HTTPException(404, "Not found")
    return o


@api_router.get("/orders")
async def list_orders(
    status_group: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    admin: dict = Depends(require_admin),
    pool: asyncpg.Pool = Depends(db_pool),
):
    params = []
    where = []

    pending = ["order_placed", "accepted", "preparing", "ready", "served"]
    if status_group == "active":
        params.append(pending)
        where.append(f"order_status = ANY(${len(params)}::text[])")
    elif status_group == "history":
        params.append(["completed", "rejected", "cancelled"])
        where.append(f"order_status = ANY(${len(params)}::text[])")

    if search:
        params.append(f"%{search}%")
        idx = len(params)
        where.append(
            f"(order_number ILIKE ${idx} OR customer_name ILIKE ${idx} OR mobile_number ILIKE ${idx} OR table_number ILIKE ${idx})"
        )

    if start_date:
        try:
            d_start = datetime.fromisoformat(start_date.replace("Z", "+00:00")).date()
            params.append(d_start)
            where.append(f"created_at::date >= ${len(params)}::date")
        except Exception:
            pass
    if end_date:
        try:
            d_end = datetime.fromisoformat(end_date.replace("Z", "+00:00")).date()
            params.append(d_end)
            where.append(f"created_at::date <= ${len(params)}::date")
        except Exception:
            pass

    where_sql = ""
    if where:
        where_sql = "WHERE " + " AND ".join(where)

    rows = await pool.fetch(f"SELECT * FROM orders {where_sql} ORDER BY created_at DESC", *params)
    return rows_to_dicts(rows)


@api_router.patch("/orders/{oid}/status")
async def update_status(oid: str, body: StatusUpdate, admin: dict = Depends(require_admin), pool: asyncpg.Pool = Depends(db_pool)):
    o = await pool.fetchrow("SELECT * FROM orders WHERE id=$1", oid)
    if not o:
        raise HTTPException(404, "Not found")

    points_earned = int(o.get("points_earned") or 0)
    now = now_utc()

    if body.status == "completed" and o["order_status"] != "completed":
        if o.get("customer_id") and float(o.get("subtotal", 0)) >= MIN_ORDER_FOR_POINTS:
            pts = int(float(o["subtotal"]) * POINTS_PER_RUPEE)
            points_earned = pts
            await pool.execute(
                "UPDATE customers SET total_points = total_points + $1, updated_at=$2 WHERE id=$3",
                pts,
                now,
                o["customer_id"],
            )
            await pool.execute(
                """
                INSERT INTO loyalty_transactions(id, customer_id, order_id, transaction_type, points, description, created_at)
                VALUES($1,$2,$3,$4,$5,$6,$7)
                """,
                str(uuid.uuid4()),
                o["customer_id"],
                oid,
                "earned",
                pts,
                f"Earned on order {o['order_number']}",
                now,
            )

    await pool.execute(
        "UPDATE orders SET order_status=$1, points_earned=$2, updated_at=$3 WHERE id=$4",
        body.status,
        points_earned,
        now,
        oid,
    )
    row = await pool.fetchrow("SELECT * FROM orders WHERE id=$1", oid)
    return row_to_dict(row)


@api_router.get("/customer/orders")
async def customer_orders(c: dict = Depends(require_customer), pool: asyncpg.Pool = Depends(db_pool)):
    rows = await pool.fetch("SELECT * FROM orders WHERE customer_id=$1 ORDER BY created_at DESC", c["id"])
    return rows_to_dicts(rows)


@api_router.get("/customer/points-history")
async def points_history(c: dict = Depends(require_customer), pool: asyncpg.Pool = Depends(db_pool)):
    rows = await pool.fetch(
        "SELECT * FROM loyalty_transactions WHERE customer_id=$1 ORDER BY created_at DESC",
        c["id"],
    )
    return rows_to_dicts(rows)


@api_router.get("/dashboard/stats")
async def dashboard_stats(admin: dict = Depends(require_admin), pool: asyncpg.Pool = Depends(db_pool)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    todays_orders = rows_to_dicts(
        await pool.fetch("SELECT total_amount, order_status FROM orders WHERE created_at >= $1", today_start)
    )
    monthly_orders = rows_to_dicts(
        await pool.fetch("SELECT total_amount, order_status FROM orders WHERE created_at >= $1", month_start)
    )
    pending_orders = await pool.fetchval(
        "SELECT COUNT(*) FROM orders WHERE order_status = ANY($1::text[])",
        ["order_placed", "accepted", "preparing", "ready"],
    )
    completed_today = [o for o in todays_orders if o["order_status"] == "completed"]

    todays_sales = sum(float(o["total_amount"]) for o in completed_today)
    monthly_sales = sum(float(o["total_amount"]) for o in monthly_orders if o["order_status"] == "completed")

    recent = rows_to_dicts(await pool.fetch("SELECT * FROM orders ORDER BY created_at DESC LIMIT 8"))
    return {
        "todays_sales": round(todays_sales, 2),
        "orders_today": len(todays_orders),
        "monthly_sales": round(monthly_sales, 2),
        "pending_orders": int(pending_orders or 0),
        "completed_today": len(completed_today),
        "recent_orders": recent,
    }


@app.on_event("startup")
async def startup():
    import asyncio
    pool = None
    try:
        pool = await asyncio.wait_for(
            asyncpg.create_pool(SUPABASE_DB_URL, min_size=1, max_size=10, ssl="require"),
            timeout=3.0
        )
        logger.info("Connected to Supabase PostgreSQL database successfully")
    except Exception as e:
        logger.warning(f"Could not connect to Supabase DB ({e}). Falling back to local SQLite database: carolina_lounge.db")
        pool = SQLitePool("carolina_lounge.db")
    app.state.pool = pool

    await ensure_schema(pool)

    if os.environ.get("WIPE_ALL_DATA_ON_STARTUP", "true").lower() == "true":
        await wipe_all_data(pool)

    await seed_startup(pool)


@api_router.get("/")
async def root():
    return {"service": "# CAROLINA Lounge API", "status": "ok"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    pool = getattr(app.state, "pool", None)
    if pool:
        await pool.close()

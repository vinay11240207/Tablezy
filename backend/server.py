from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

# ---------- DB ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
TAX_RATE = float(os.environ.get('TAX_RATE', '0.05'))
POINTS_PER_RUPEE = float(os.environ.get('POINTS_PER_RUPEE', '0.1'))
MIN_ORDER_FOR_POINTS = float(os.environ.get('MIN_ORDER_FOR_POINTS', '100'))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tablezy")

app = FastAPI(title="Tablezy API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


async def require_admin(cred: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not cred:
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(cred.credentials)
    if payload.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    admin = await db.admins.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not admin:
        raise HTTPException(401, "Admin not found")
    return admin


async def require_customer(cred: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not cred:
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(cred.credentials)
    if payload.get("role") != "customer":
        raise HTTPException(403, "Customer only")
    c = await db.customers.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not c:
        raise HTTPException(401, "Customer not found")
    return c


async def optional_customer(cred: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[dict]:
    if not cred:
        return None
    try:
        payload = decode_token(cred.credentials)
        if payload.get("role") != "customer":
            return None
        return await db.customers.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    except Exception:
        return None


# ---------- Models ----------
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
    reward_id: Optional[str] = None  # optional redemption


class StatusUpdate(BaseModel):
    status: Literal["order_placed", "accepted", "preparing", "ready", "served", "completed", "rejected", "cancelled"]


class RewardIn(BaseModel):
    reward_name: str
    description: str = ""
    points_required: int
    reward_type: Literal["free_item", "discount"] = "free_item"
    menu_item_id: Optional[str] = None
    discount_amount: float = 0
    is_active: bool = True


# ---------- Auth Routes ----------
@api_router.post("/auth/admin/login")
async def admin_login(body: AdminLogin):
    admin = await db.admins.find_one({"email": body.email.lower().strip()})
    if not admin or not verify_pw(body.password, admin["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = make_token(admin["id"], "admin")
    return {
        "token": token,
        "user": {"id": admin["id"], "name": admin["name"], "email": admin["email"], "role": "admin"},
    }


@api_router.post("/auth/customer/register")
async def customer_register(body: CustomerRegister):
    mobile = body.mobile_number.strip()
    if len(mobile) < 8:
        raise HTTPException(400, "Invalid mobile number")
    existing = await db.customers.find_one({"mobile_number": mobile})
    if existing:
        raise HTTPException(400, "Mobile number already registered")
    cid = str(uuid.uuid4())
    doc = {
        "id": cid,
        "name": body.name.strip(),
        "mobile_number": mobile,
        "password_hash": hash_pw(body.password),
        "total_points": 0,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.customers.insert_one(doc)
    token = make_token(cid, "customer")
    return {
        "token": token,
        "user": {"id": cid, "name": doc["name"], "mobile_number": mobile, "total_points": 0},
    }


@api_router.post("/auth/customer/login")
async def customer_login(body: CustomerLogin):
    c = await db.customers.find_one({"mobile_number": body.mobile_number.strip()})
    if not c or not verify_pw(body.password, c["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = make_token(c["id"], "customer")
    return {
        "token": token,
        "user": {"id": c["id"], "name": c["name"], "mobile_number": c["mobile_number"], "total_points": c.get("total_points", 0)},
    }


@api_router.get("/auth/me")
async def get_admin_me(admin: dict = Depends(require_admin)):
    return {"user": admin, "role": "admin"}


@api_router.get("/auth/customer/me")
async def get_customer_me(c: dict = Depends(require_customer)):
    return {"user": {"id": c["id"], "name": c["name"], "mobile_number": c["mobile_number"], "total_points": c.get("total_points", 0)}}


# ---------- Categories ----------
@api_router.get("/categories")
async def list_categories():
    docs = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return docs


@api_router.post("/categories")
async def create_category(body: CategoryIn, admin: dict = Depends(require_admin)):
    cid = str(uuid.uuid4())
    doc = {"id": cid, "name": body.name.strip(), "is_active": body.is_active, "created_at": now_iso()}
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/categories/{cid}")
async def delete_category(cid: str, admin: dict = Depends(require_admin)):
    await db.categories.delete_one({"id": cid})
    return {"ok": True}


# ---------- Menu ----------
@api_router.get("/menu")
async def get_menu(only_available: bool = False):
    q = {"is_available": True} if only_available else {}
    items = await db.menu_items.find(q, {"_id": 0}).to_list(1000)
    cats = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return {"items": items, "categories": cats}


@api_router.post("/menu")
async def create_menu_item(body: MenuItemIn, admin: dict = Depends(require_admin)):
    mid = str(uuid.uuid4())
    doc = {
        "id": mid, "category_id": body.category_id, "name": body.name.strip(),
        "description": body.description, "price": float(body.price),
        "image_url": body.image_url, "is_available": body.is_available,
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.menu_items.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/menu/{mid}")
async def update_menu_item(mid: str, body: MenuItemIn, admin: dict = Depends(require_admin)):
    update = body.model_dump()
    update["price"] = float(update["price"])
    update["updated_at"] = now_iso()
    r = await db.menu_items.update_one({"id": mid}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.menu_items.find_one({"id": mid}, {"_id": 0})


@api_router.patch("/menu/{mid}/availability")
async def toggle_availability(mid: str, is_available: bool, admin: dict = Depends(require_admin)):
    await db.menu_items.update_one({"id": mid}, {"$set": {"is_available": is_available, "updated_at": now_iso()}})
    return await db.menu_items.find_one({"id": mid}, {"_id": 0})


@api_router.delete("/menu/{mid}")
async def delete_menu_item(mid: str, admin: dict = Depends(require_admin)):
    await db.menu_items.delete_one({"id": mid})
    return {"ok": True}


# ---------- Rewards ----------
@api_router.get("/rewards")
async def list_rewards(active_only: bool = False):
    q = {"is_active": True} if active_only else {}
    return await db.rewards.find(q, {"_id": 0}).to_list(500)


@api_router.post("/rewards")
async def create_reward(body: RewardIn, admin: dict = Depends(require_admin)):
    rid = str(uuid.uuid4())
    doc = {"id": rid, **body.model_dump(), "created_at": now_iso()}
    await db.rewards.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/rewards/{rid}")
async def update_reward(rid: str, body: RewardIn, admin: dict = Depends(require_admin)):
    r = await db.rewards.update_one({"id": rid}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.rewards.find_one({"id": rid}, {"_id": 0})


@api_router.delete("/rewards/{rid}")
async def delete_reward(rid: str, admin: dict = Depends(require_admin)):
    await db.rewards.delete_one({"id": rid})
    return {"ok": True}


@api_router.post("/rewards/{rid}/redeem")
async def redeem_reward(rid: str, c: dict = Depends(require_customer)):
    reward = await db.rewards.find_one({"id": rid, "is_active": True})
    if not reward:
        raise HTTPException(404, "Reward not found")
    if c.get("total_points", 0) < reward["points_required"]:
        raise HTTPException(400, "Insufficient points")
    new_points = c["total_points"] - reward["points_required"]
    await db.customers.update_one({"id": c["id"]}, {"$set": {"total_points": new_points, "updated_at": now_iso()}})
    tx = {
        "id": str(uuid.uuid4()), "customer_id": c["id"], "order_id": None,
        "transaction_type": "redeemed", "points": -reward["points_required"],
        "description": f"Redeemed: {reward['reward_name']}", "created_at": now_iso(),
    }
    await db.loyalty_transactions.insert_one(tx)
    redemption = {
        "id": str(uuid.uuid4()), "customer_id": c["id"], "reward_id": rid,
        "reward_name": reward["reward_name"], "status": "issued",
        "created_at": now_iso(),
    }
    await db.redemptions.insert_one(redemption)
    redemption.pop("_id", None)
    return {"redemption": redemption, "new_balance": new_points}


# ---------- Orders ----------
async def _generate_order_number() -> str:
    count = await db.orders.count_documents({})
    return f"ORD{1000 + count + 1}"


@api_router.post("/orders")
async def create_order(body: OrderIn, current: Optional[dict] = Depends(optional_customer)):
    if not body.items:
        raise HTTPException(400, "Cart is empty")
    if not body.customer_name.strip() or not body.mobile_number.strip() or not body.table_number.strip():
        raise HTTPException(400, "Missing required fields")

    subtotal = 0.0
    order_items = []
    for it in body.items:
        mi = await db.menu_items.find_one({"id": it.menu_item_id}, {"_id": 0})
        if not mi:
            raise HTTPException(400, f"Item not found: {it.menu_item_id}")
        if not mi.get("is_available"):
            raise HTTPException(400, f"Item unavailable: {mi['name']}")
        line = float(mi["price"]) * int(it.quantity)
        subtotal += line
        order_items.append({
            "id": str(uuid.uuid4()), "menu_item_id": mi["id"], "item_name": mi["name"],
            "item_price": float(mi["price"]), "quantity": int(it.quantity), "item_total": line,
        })

    reward_discount = 0.0
    reward_applied = None
    if body.reward_id and current:
        reward = await db.rewards.find_one({"id": body.reward_id, "is_active": True})
        if not reward:
            raise HTTPException(400, "Invalid reward")
        if current.get("total_points", 0) < reward["points_required"]:
            raise HTTPException(400, "Insufficient points")
        if reward["reward_type"] == "discount":
            reward_discount = float(reward.get("discount_amount", 0))
        reward_applied = reward

    tax = round(subtotal * TAX_RATE, 2)
    total = round(max(0, subtotal + tax - reward_discount), 2)

    onum = await _generate_order_number()
    oid = str(uuid.uuid4())
    order = {
        "id": oid, "order_number": onum,
        "customer_id": current["id"] if current else None,
        "customer_name": body.customer_name.strip(),
        "mobile_number": body.mobile_number.strip(),
        "table_number": body.table_number.strip(),
        "subtotal": round(subtotal, 2), "tax_amount": tax,
        "discount_amount": reward_discount,
        "total_amount": total,
        "order_status": "order_placed",
        "points_earned": 0,
        "points_redeemed": reward_applied["points_required"] if reward_applied else 0,
        "reward_id": body.reward_id if reward_applied else None,
        "reward_name": reward_applied["reward_name"] if reward_applied else None,
        "items": order_items,
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.orders.insert_one(order)

    if reward_applied:
        await db.customers.update_one(
            {"id": current["id"]},
            {"$inc": {"total_points": -reward_applied["points_required"]}, "$set": {"updated_at": now_iso()}},
        )
        await db.loyalty_transactions.insert_one({
            "id": str(uuid.uuid4()), "customer_id": current["id"], "order_id": oid,
            "transaction_type": "redeemed", "points": -reward_applied["points_required"],
            "description": f"Redeemed on order {onum}", "created_at": now_iso(),
        })

    order.pop("_id", None)
    return order


@api_router.get("/orders/{oid}")
async def get_order(oid: str):
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
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
):
    q = {}
    pending = ["order_placed", "accepted", "preparing", "ready", "served"]
    if status_group == "active":
        q["order_status"] = {"$in": pending}
    elif status_group == "history":
        q["order_status"] = {"$in": ["completed", "rejected", "cancelled"]}
    if search:
        q["$or"] = [
            {"order_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"mobile_number": {"$regex": search, "$options": "i"}},
            {"table_number": {"$regex": search, "$options": "i"}},
        ]
    if start_date:
        q.setdefault("created_at", {})["$gte"] = start_date
    if end_date:
        q.setdefault("created_at", {})["$lte"] = end_date
    orders = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return orders


@api_router.patch("/orders/{oid}/status")
async def update_status(oid: str, body: StatusUpdate, admin: dict = Depends(require_admin)):
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(404, "Not found")
    update = {"order_status": body.status, "updated_at": now_iso()}

    # credit points on completion
    if body.status == "completed" and o["order_status"] != "completed":
        if o.get("customer_id") and o.get("subtotal", 0) >= MIN_ORDER_FOR_POINTS:
            pts = int(o["subtotal"] * POINTS_PER_RUPEE)
            update["points_earned"] = pts
            await db.customers.update_one(
                {"id": o["customer_id"]},
                {"$inc": {"total_points": pts}, "$set": {"updated_at": now_iso()}},
            )
            await db.loyalty_transactions.insert_one({
                "id": str(uuid.uuid4()), "customer_id": o["customer_id"], "order_id": oid,
                "transaction_type": "earned", "points": pts,
                "description": f"Earned on order {o['order_number']}", "created_at": now_iso(),
            })
    await db.orders.update_one({"id": oid}, {"$set": update})
    return await db.orders.find_one({"id": oid}, {"_id": 0})


# ---------- Customer-specific ----------
@api_router.get("/customer/orders")
async def customer_orders(c: dict = Depends(require_customer)):
    return await db.orders.find({"customer_id": c["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api_router.get("/customer/points-history")
async def points_history(c: dict = Depends(require_customer)):
    return await db.loyalty_transactions.find({"customer_id": c["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


# ---------- Dashboard Stats ----------
@api_router.get("/dashboard/stats")
async def dashboard_stats(admin: dict = Depends(require_admin)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    todays_orders = await db.orders.find({"created_at": {"$gte": today_start}}, {"_id": 0}).to_list(2000)
    monthly_orders = await db.orders.find({"created_at": {"$gte": month_start}}, {"_id": 0}).to_list(5000)
    pending_orders = await db.orders.count_documents({"order_status": {"$in": ["order_placed", "accepted", "preparing", "ready"]}})
    completed_today = [o for o in todays_orders if o["order_status"] == "completed"]

    todays_sales = sum(o["total_amount"] for o in completed_today)
    monthly_sales = sum(o["total_amount"] for o in monthly_orders if o["order_status"] == "completed")

    recent = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
    return {
        "todays_sales": round(todays_sales, 2),
        "orders_today": len(todays_orders),
        "monthly_sales": round(monthly_sales, 2),
        "pending_orders": pending_orders,
        "completed_today": len(completed_today),
        "recent_orders": recent,
    }


# ---------- Seed ----------
async def seed_startup():
    # indexes
    await db.customers.create_index("mobile_number", unique=True)
    await db.admins.create_index("email", unique=True)
    await db.orders.create_index("order_number", unique=True)
    await db.orders.create_index("created_at")

    # admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@tablezy.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.admins.find_one({"email": admin_email})
    if not existing:
        await db.admins.insert_one({
            "id": str(uuid.uuid4()), "name": "Cafe Owner", "email": admin_email,
            "password_hash": hash_pw(admin_pw), "role": "admin", "created_at": now_iso(),
        })
        logger.info(f"Seeded admin: {admin_email}")

    # seed categories if empty
    if await db.categories.count_documents({}) == 0:
        default_cats = ["Coffee", "Tea", "Pizza", "Burger", "Sandwich", "Pasta", "Shakes", "Snacks", "Desserts"]
        docs = [{"id": str(uuid.uuid4()), "name": n, "is_active": True, "created_at": now_iso()} for n in default_cats]
        await db.categories.insert_many(docs)
        logger.info("Seeded default categories")

    # seed sample menu if empty
    if await db.menu_items.count_documents({}) == 0:
        cats = await db.categories.find({}, {"_id": 0}).to_list(50)
        cmap = {c["name"]: c["id"] for c in cats}
        samples = [
            ("Coffee", "Cappuccino", "Rich espresso topped with velvety foam", 140,
             "https://images.unsplash.com/photo-1529892485617-25f63cd7b1e9?w=600&auto=format&fit=crop"),
            ("Coffee", "Cold Brew", "Slow-steeped, smooth and refreshing", 180,
             "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&auto=format&fit=crop"),
            ("Pizza", "Margherita", "Fresh basil, mozzarella, tomato sauce", 320,
             "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop"),
            ("Burger", "Classic Cheeseburger", "Grilled patty, cheddar, house sauce", 260, ""),
            ("Desserts", "Chocolate Croissant", "Buttery flaky pastry with dark chocolate", 120,
             "https://images.unsplash.com/photo-1623334044303-241021148842?w=600&auto=format&fit=crop"),
            ("Shakes", "Cold Coffee Shake", "Frothy, iced, indulgent", 190, ""),
        ]
        docs = []
        for cat, name, desc, price, img in samples:
            if cat in cmap:
                docs.append({
                    "id": str(uuid.uuid4()), "category_id": cmap[cat], "name": name,
                    "description": desc, "price": price, "image_url": img,
                    "is_available": True, "created_at": now_iso(), "updated_at": now_iso(),
                })
        if docs:
            await db.menu_items.insert_many(docs)
            logger.info(f"Seeded {len(docs)} menu items")

    # seed rewards if empty
    if await db.rewards.count_documents({}) == 0:
        rewards = [
            {"reward_name": "Free Cold Coffee", "description": "Redeem a chilled cold coffee", "points_required": 100, "reward_type": "free_item"},
            {"reward_name": "Free French Fries", "description": "Crispy golden fries", "points_required": 150, "reward_type": "free_item"},
            {"reward_name": "₹200 Off Order", "description": "Flat ₹200 discount", "points_required": 500, "reward_type": "discount", "discount_amount": 200},
        ]
        for r in rewards:
            r.update({"id": str(uuid.uuid4()), "menu_item_id": None, "is_active": True, "created_at": now_iso()})
        await db.rewards.insert_many(rewards)


@app.on_event("startup")
async def startup():
    await seed_startup()


@api_router.get("/")
async def root():
    return {"service": "Tablezy API", "status": "ok"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

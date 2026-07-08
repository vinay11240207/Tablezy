# Tablezy — Product Requirements Document

## Original Problem Statement
Tablezy is a smart web-based cafe ordering and management application with two completely
separate interfaces (Customer Ordering Website + Admin/Cafe Owner Dashboard) sharing the same
backend and MongoDB database. Customer app should open directly to the menu (no landing page).
Admin manages orders/menu/loyalty. Registered customers earn loyalty points on completed
orders and can redeem them for rewards.

## User Personas
1. **Cafe Customer** (guest or registered) — scans QR/opens site, orders food from table
2. **Cafe Owner / Admin** — manages menu, orders, sales, loyalty program

## Core Requirements
- Direct-to-menu customer landing, no intro page
- Search, categories, add-to-cart with qty controls
- Cart with subtotal + tax + total (5% GST)
- Mandatory table number + customer name + mobile before placing order
- Guest ordering allowed; registered customers earn points (10 pts per ₹100, min ₹100)
- Order tracking: order_placed → accepted → preparing → ready → served → completed
- Admin dashboard with 5 KPIs + recent orders
- Admin: active orders with status action buttons, order history with filters, menu CRUD, loyalty CRUD

## Architecture
- **Backend**: FastAPI + MongoDB (motor), JWT bearer tokens (separate roles: admin/customer)
- **Frontend**: React 19 + React Router 7 + shadcn/ui + Tailwind + Sonner
- **Auth**: Two token stores in localStorage (`tablezy_admin_token`, `tablezy_customer_token`);
  two axios instances (`api`, `apiAdmin`)
- **Real-time**: Polling every 4–5s on admin orders & dashboard

## Implemented (Feb 2026)
- ✅ Full customer flow: menu browse → search → cart → checkout → order → track
- ✅ Guest ordering + customer registration/login (mobile + password)
- ✅ Loyalty: earn points on completed orders (subtotal ≥ ₹100), redeem rewards
- ✅ Admin auth (admin@tablezy.com / admin123 auto-seeded)
- ✅ Admin dashboard with live KPIs (today's sales, orders today, monthly sales, pending, completed)
- ✅ Admin orders: real-time polling, status action buttons, new-order toast
- ✅ Admin order history with date range filters + search
- ✅ Admin menu CRUD, category add, availability toggle
- ✅ Admin loyalty rewards CRUD
- ✅ Admin help / FAQ page
- ✅ Seeded 9 categories, 6 sample menu items, 3 rewards on first boot

## Prioritized Backlog
### P0 (blocking)
- (none)

### P1 (should have)
- Firebase / WebSocket real-time (user asked to swap in later once keys are provided)
- Admin image upload widget (currently image URL field; add object storage later)
- Forgot-password flow for admin/customer

### P2 (nice to have)
- OTP-based customer login
- QR code generator for cafe tables (Admin → Tables page)
- Print / KOT ticket for kitchen
- Analytics charts on dashboard (Recharts already installed)
- CSV export of order history

## Next Tasks
1. Optional: swap polling for Firebase realtime once user provides Firebase config
2. Add object storage for admin menu image uploads
3. Print KOT / kitchen-ready view

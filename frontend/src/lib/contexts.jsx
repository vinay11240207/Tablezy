import React, { createContext, useContext, useEffect, useState } from "react";
import { api, apiAdmin } from "./api";

// ---------- Customer Auth ----------
const CustomerCtx = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("tablezy_customer_token");
    if (!t) { setLoading(false); return; }
    api.get("/auth/customer/me")
      .then(({ data }) => setCustomer(data.user))
      .catch(() => localStorage.removeItem("tablezy_customer_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (mobile_number, password) => {
    const { data } = await api.post("/auth/customer/login", { mobile_number, password });
    localStorage.setItem("tablezy_customer_token", data.token);
    setCustomer(data.user);
    return data.user;
  };
  const register = async (name, mobile_number, password) => {
    const { data } = await api.post("/auth/customer/register", { name, mobile_number, password });
    localStorage.setItem("tablezy_customer_token", data.token);
    setCustomer(data.user);
    return data.user;
  };
  const logout = () => {
    localStorage.removeItem("tablezy_customer_token");
    setCustomer(null);
  };
  const refresh = async () => {
    try {
      const { data } = await api.get("/auth/customer/me");
      setCustomer(data.user);
    } catch { /* ignore */ }
  };

  return (
    <CustomerCtx.Provider value={{ customer, loading, login, register, logout, refresh }}>
      {children}
    </CustomerCtx.Provider>
  );
}
export const useCustomerAuth = () => useContext(CustomerCtx);

// ---------- Admin Auth ----------
const AdminCtx = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("tablezy_admin_token");
    if (!t) { setLoading(false); return; }
    apiAdmin.get("/auth/me")
      .then(({ data }) => setAdmin(data.user))
      .catch(() => localStorage.removeItem("tablezy_admin_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await apiAdmin.post("/auth/admin/login", { email, password });
    localStorage.setItem("tablezy_admin_token", data.token);
    setAdmin(data.user);
    return data.user;
  };
  const logout = () => {
    localStorage.removeItem("tablezy_admin_token");
    setAdmin(null);
  };

  return (
    <AdminCtx.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AdminCtx.Provider>
  );
}
export const useAdminAuth = () => useContext(AdminCtx);

// ---------- Cart ----------
const CartCtx = createContext(null);
const CART_KEY = "tablezy_cart_v1";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const add = (item) => setItems((prev) => {
    const found = prev.find((i) => i.id === item.id);
    if (found) return prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
    return [...prev, { id: item.id, name: item.name, price: item.price, image_url: item.image_url, quantity: 1 }];
  });
  const addReward = (reward) => setItems((prev) => {
    const alreadyReward = prev.find((i) => i.is_reward);
    if (alreadyReward) return prev; // only one reward per order
    return [...prev, {
      id: `reward-${reward.id}`, name: `🎁 ${reward.reward_name}`, price: 0,
      image_url: "", quantity: 1, is_reward: true, reward_id: reward.id,
      reward_type: reward.reward_type, discount_amount: reward.discount_amount || 0,
      points_required: reward.points_required,
    }];
  });
  const inc = (id) => setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: i.is_reward ? 1 : i.quantity + 1 } : i));
  const dec = (id) => setItems((prev) => prev
    .map((i) => i.id === id ? { ...i, quantity: i.is_reward ? 1 : i.quantity - 1 } : i)
    .filter((i) => i.quantity > 0));
  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  const clear = () => setItems([]);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.filter((i) => !i.is_reward).reduce((s, i) => s + i.quantity * i.price, 0);
  const rewardLine = items.find((i) => i.is_reward) || null;

  return (
    <CartCtx.Provider value={{ items, add, addReward, inc, dec, remove, clear, count, subtotal, rewardLine }}>
      {children}
    </CartCtx.Provider>
  );
}
export const useCart = () => useContext(CartCtx);

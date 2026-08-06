import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";
export const API = `${BACKEND_URL.replace(/\/$/, "")}/api`;

// Public / customer-scoped axios: sends customer token if present.
export const api = axios.create({ baseURL: API });
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("tablezy_customer_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// Admin-scoped axios: sends admin token.
export const apiAdmin = axios.create({ baseURL: API });
apiAdmin.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("tablezy_admin_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export default api;

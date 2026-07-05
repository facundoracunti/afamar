// The backend mounts every router under /api/v1 (see app/api/routers/router.py).
// Services should call paths like "/clients" or "/auth/login" — http.ts appends
// the /api/v1 prefix automatically.
//
// Response shape: every JSON reply is the {success, data, error} envelope;
// we unwrap it here. Keys stay snake_case end-to-end so the frontend matches
// the backend (Pydantic) literally — no implicit conversion.
import axios from "axios";

export const API_URL = window.APP_CONFIG?.API_URL || '/api/v1';

const http = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!(config.data instanceof FormData) && !config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json";
  }
  return config;
});

http.interceptors.response.use(
  (res) => {
    if (res.status === 204) return res;
    if (res.data && "success" in res.data) {
      if (!res.data.success) {
        return Promise.reject(new Error(res.data.error || "Error"));
      }
      // Lift pagination to a sibling property before unwrapping `data`,
      // so non-paginated callers keep their `res.data as T` shape.
      if (res.data.pagination) {
        (res as typeof res & { pagination?: unknown }).pagination = res.data.pagination;
      }
      res.data = res.data.data;
    }
    return res;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      if (window.location.pathname.startsWith("/admin")) {
        window.location.href = "/login";
      }
    }
    const msg = error.response?.data?.error || error.response?.data?.detail?.[0]?.msg || error.message || "Error de conexión";
    return Promise.reject(new Error(msg));
  },
);

export default http;

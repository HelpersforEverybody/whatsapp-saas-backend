// frontend/src/hooks/useApi.js
const API_BASE = import.meta.env.VITE_API_BASE || "https://whatsapp-saas-backend-f9ot.onrender.com";

export function getApiBase() {
  return API_BASE;
}

export function getMerchantToken() {
  return localStorage.getItem("merchant_token") || "";
}

export async function apiFetch(path, opts = {}) {
  opts = { ...opts };
  opts.headers = opts.headers || {};
  // set JSON header if body present and content-type not set
  if (opts.body && !opts.headers["Content-Type"]) {
    opts.headers["Content-Type"] = "application/json";
  }
  const token = getMerchantToken();
  if (token) {
    opts.headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  return res;
}

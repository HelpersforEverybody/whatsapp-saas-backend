// frontend/src/hooks/useApi.js
const API_BASE = import.meta.env.VITE_API_BASE || "https://whatsapp-saas-backend-f9ot.onrender.com";

export function getApiBase() {
  return API_BASE;
}

// Merchant token helpers
export function getMerchantToken() {
  return localStorage.getItem("merchant_token") || "";
}

// Customer token helpers
export function getCustomerToken() {
  return localStorage.getItem("customer_token") || "";
}

// Generic fetch that attaches merchant OR customer auth automatically
export async function apiFetch(path, opts = {}) {
  opts = { ...opts };
  opts.headers = opts.headers || {};

  if (opts.body && !opts.headers["Content-Type"]) {
    opts.headers["Content-Type"] = "application/json";
  }

  // attach either merchant or customer token automatically
  const merchantToken = getMerchantToken();
  const customerToken = getCustomerToken();
  const token = merchantToken || customerToken;
  if (token) {
    opts.headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, opts);
  return res;
}

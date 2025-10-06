// frontend/src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useSocket } from "../hooks/useSocket";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "https://whatsapp-saas-backend-f9ot.onrender.com";

export default function Dashboard() {
  const { connected, on } = useSocket({ url: API_BASE });
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [shops, setShops] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [token, setToken] = useState(localStorage.getItem("admin_token") || "");
  const [password, setPassword] = useState("");

  // LOGIN
  const doLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("Login failed");
      const data = await res.json();
      localStorage.setItem("admin_token", data.token);
      setToken(data.token);
      setPassword("");
      alert("✅ Logged in successfully");
      loadOrders();
      loadShops();
    } catch (err) {
      console.error("Login error", err);
      alert("Invalid password or server error");
    }
  };

  const doLogout = () => {
    localStorage.removeItem("admin_token");
    setToken("");
    setOrders([]);
    setShops([]);
  };

  // FETCH HELPERS
  const apiFetch = async (path, opts = {}) => {
    const headers = opts.headers || {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    opts.headers = headers;
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (res.status === 401) {
      alert("Session expired. Please log in again.");
      doLogout();
      throw new Error("Unauthorized");
    }
    return res;
  };

  // LOAD ORDERS
  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await apiFetch("/api/orders");
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      setOrders(data);
      window.lastOrders = data;
    } catch (e) {
      console.error("Load orders error", e);
    } finally {
      setLoadingOrders(false);
    }
  }, [token]);

  // LOAD SHOPS
  const loadShops = useCallback(async () => {
    try {
      const res = await apiFetch("/api/shops");
      if (!res.ok) throw new Error("Failed to load shops");
      const data = await res.json();
      setShops(data);
    } catch (e) {
      console.error("Load shops error", e);
    }
  }, [token]);

  // SOCKET UPDATE
  useEffect(() => {
    const cleanup = on("orderStatusUpdate", (payload) => {
      setOrders((prev) =>
        prev.map((o) => (String(o._id) === String(payload.orderId) ? { ...o, status: payload.status } : o))
      );
    });
    return cleanup;
  }, [on]);

  // INITIAL LOAD
  useEffect(() => {
    if (token) {
      loadOrders();
      loadShops();
    }
  }, [token, loadOrders, loadShops]);

  const updateStatus = async (orderId, newStatus) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
    } catch (e) {
      console.error("Update status error", e);
      alert("Failed to update status");
    }
  };

  const openShopMenu = (shopId) => navigate(`/shops?open=${shopId}`);

  // LOGIN VIEW
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-md mx-auto bg-white shadow-lg rounded-xl p-6">
          <h1 className="text-2xl font-semibold mb-4 text-center text-blue-600">Merchant Login</h1>
          <form onSubmit={doLogin} className="space-y-3">
            <input
              className="border border-gray-300 rounded p-2 w-full"
              placeholder="Admin password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded">
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // DASHBOARD VIEW
  return (
    <div className="max-w-5xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Merchant Dashboard</h1>
          <div className="text-sm text-gray-500">Manage orders & quick-access your shops</div>
        </div>
        <div className="flex gap-3 items-center text-sm">
          {connected ? (
            <span className="text-green-600 font-medium">🟢 Live</span>
          ) : (
            <span className="text-red-600">🔴 Offline</span>
          )}
          <button onClick={doLogout} className="bg-red-500 text-white px-3 py-1 rounded">
            Logout
          </button>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2 bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Recent Orders</h2>
            <button onClick={loadOrders} className="px-3 py-1 rounded-md bg-gray-100">
              Refresh
            </button>
          </div>

          {loadingOrders ? (
            <div className="text-sm text-gray-500">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="text-sm text-gray-500">No orders found</div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order._id} className="flex flex-col sm:flex-row justify-between p-3 bg-white rounded-md border">
                  <div>
                    <div className="font-semibold">
                      {order.customerName}{" "}
                      <span className="text-xs text-gray-400">• {order.phone}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Items: {order.items.map((i) => `${i.name} x${i.qty}`).join(", ")}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Total: ₹{order.total}</div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 sm:mt-0">
                    <div className="text-sm">
                      <span className="font-medium">Status:</span>{" "}
                      <span className="text-blue-600 font-semibold">{order.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {["accepted", "packed", "out-for-delivery", "delivered"].map((st) => {
                        const isActive = st === order.status;
                        const disabled =
                          ["accepted", "packed", "out-for-delivery", "delivered"].indexOf(st) <
                          ["accepted", "packed", "out-for-delivery", "delivered"].indexOf(order.status);
                        return (
                          <button
                            key={st}
                            onClick={() => updateStatus(order._id, st)}
                            disabled={disabled}
                            className={`px-2 py-1 rounded-md text-sm ${
                              isActive
                                ? "bg-green-600 text-white"
                                : disabled
                                ? "bg-gray-200 text-gray-600"
                                : "bg-blue-600 text-white"
                            }`}
                          >
                            {isActive ? `✅ ${st}` : st}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-lg font-medium mb-3">Shops</h3>
          {shops.length === 0 ? (
            <div className="text-sm text-gray-500">No shops found</div>
          ) : (
            <div className="space-y-3">
              {shops.map((s) => (
                <div key={s._id} className="flex items-center justify-between border rounded-md p-2">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.phone}</div>
                  </div>
                  <button
                    onClick={() => openShopMenu(s._id)}
                    className="px-3 py-1 rounded-md bg-blue-600 text-white"
                  >
                    Open Menu
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

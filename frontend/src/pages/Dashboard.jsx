// src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useSocket } from "../hooks/useSocket";

// API base & key
const API_BASE =
  import.meta.env.VITE_API_BASE || "https://whatsapp-saas-backend-f9ot.onrender.com";
const API_KEY =
  import.meta.env.VITE_API_KEY || "S3cR3t-1234-DoNotShare"; // fallback for now

export default function Dashboard() {
  const { connected, joinOrder, on } = useSocket({ url: API_BASE });
  const [orders, setOrders] = useState([]);

  // Fetch recent orders
  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        headers: { "x-api-key": API_KEY },
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setOrders(data);
      window.lastOrders = data; // helper for console use
    } catch (e) {
      console.error("Load orders error", e);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Listen for socket updates
  useEffect(() => {
    const cleanup = on("orderStatusUpdate", (payload) => {
      setOrders((prev) =>
        prev.map((o) =>
          String(o._id) === String(payload.orderId)
            ? { ...o, status: payload.status }
            : o
        )
      );
    });
    return cleanup;
  }, [on]);

  // PATCH order status
  const updateStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) =>
          prev.map((o) =>
            o._id === updated._id ? { ...o, status: updated.status } : o
          )
        );
        console.log("✅ Status updated:", updated._id, updated.status);
      } else {
        console.warn("❌ Failed to update:", res.status);
      }
    } catch (e) {
      console.error("PATCH error", e);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "30px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Merchant Dashboard</h1>
        <div>
          {connected ? (
            <span style={{ color: "green" }}>🟢 Live</span>
          ) : (
            <span style={{ color: "red" }}>🔴 Offline</span>
          )}
        </div>
      </header>

      <button
        onClick={loadOrders}
        style={{
          padding: "8px 14px",
          borderRadius: 8,
          background: "#eee",
          marginTop: 20,
        }}
      >
        Refresh Orders
      </button>

      <section style={{ marginTop: 20 }}>
        {orders.length === 0 ? (
          <div>No orders found</div>
        ) : (
          orders.map((order) => (
            <div
              key={order._id}
              data-order-id={order._id}
              style={{
                background: "#fff",
                marginBottom: 14,
                padding: 16,
                borderRadius: 10,
                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
              }}
            >
              <b>{order.customerName}</b> — {order.phone}
              <div>
                Status:{" "}
                <b className="order-status" style={{ color: "#0070f3" }}>
                  {order.status}
                </b>
              </div>
              <div>Items: {order.items.map((i) => i.name).join(", ")}</div>
              <div>Total: ₹{order.total}</div>

              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                {["accepted", "packed", "out-for-delivery", "delivered"].map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => updateStatus(order._id, st)}
                      style={{
                        background: "#007bff",
                        color: "white",
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

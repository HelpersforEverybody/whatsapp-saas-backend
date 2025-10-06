// src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useSocket } from "../hooks/useSocket";
import OrderCard from "../components/OrderCard";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://whatsapp-saas-backend-f9ot.onrender.com";

const API_KEY = import.meta.env.VITE_API_KEY || "";

export default function Dashboard() {
  const socketUrl = API_BASE;
  const { connected, joinOrder, on } = useSocket({ url: socketUrl });
  const [orders, setOrders] = useState([]);
  const [joinedIds, setJoinedIds] = useState(new Set());

  const loadOrders = useCallback(async () => {
    try {
      console.log("API_BASE:", API_BASE);
      console.log("API_KEY:", API_KEY ? "(set)" : "(missing)");

      const res = await fetch(`${API_BASE}/api/orders`, {
        headers: {
          "x-api-key": API_KEY,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error("Load orders failed:", err);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const cleanup = on("orderStatusUpdate", (payload) => {
      setOrders((prev) => {
        const idx = prev.findIndex((o) => String(o._id) === String(payload.orderId));
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], status: payload.status };
        return next;
      });
    });
    return cleanup;
  }, [on]);

  const handleJoin = (orderId) => {
    if (!joinedIds.has(orderId)) {
      joinOrder(orderId);
      setJoinedIds(new Set(joinedIds).add(orderId));
    }
  };

  return (
    <div style={{ maxWidth: 920, margin: "28px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Merchant Dashboard</h1>
        <div>{connected ? <span style={{ color: "green" }}>Live</span> : <span style={{ color: "red" }}>Offline</span>}</div>
      </header>

      <div style={{ marginTop: 18 }}>
        <button onClick={loadOrders} style={{ padding: "8px 12px", borderRadius: 6 }}>
          Refresh Orders
        </button>
      </div>

      <section style={{ marginTop: 18 }}>
        {orders.length === 0 ? (
          <div>No orders found</div>
        ) : (
          orders.map((o) => <OrderCard key={o._id} order={o} onJoin={handleJoin} />)
        )}
      </section>
    </div>
  );
}

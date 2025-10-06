import React, { useEffect, useState, useCallback } from "react";
import { useSocket } from "../hooks/useSocket";

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://whatsapp-saas-backend-f9ot.onrender.com";
const API_KEY =
  import.meta.env.VITE_API_KEY || "S3cR3t-1234-DoNotShare";

export default function Dashboard() {
  const { connected, on } = useSocket({ url: API_BASE });
  const [orders, setOrders] = useState([]);
  const [loadingMap, setLoadingMap] = useState({});
  const [errorMap, setErrorMap] = useState({});

  // Load orders
  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        headers: { "x-api-key": API_KEY },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setOrders(data);
      window.lastOrders = data;
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

  // Update order status
  const updateStatus = async (orderId, newStatus) => {
    setLoadingMap((prev) => ({ ...prev, [orderId]: true }));
    setErrorMap((prev) => ({ ...prev, [orderId]: false }));

    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();

      setOrders((prev) =>
        prev.map((o) =>
          o._id === updated._id ? { ...o, status: updated.status } : o
        )
      );
    } catch (e) {
      console.error("PATCH error", e);
      setErrorMap((prev) => ({ ...prev, [orderId]: true }));
      setTimeout(() => {
        setErrorMap((prev) => ({ ...prev, [orderId]: false }));
      }, 2000);
    } finally {
      setLoadingMap((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // Order UI
  const renderOrder = (order) => {
    const isLoading = loadingMap[order._id];
    const isError = errorMap[order._id];
    const currentStatus = order.status;

    const statusColors = {
      received: "#777",
      accepted: "green",
      packed: "#0066cc",
      "out-for-delivery": "#ff8800",
      delivered: "#222",
    };

    const statusSteps = [
      "accepted",
      "packed",
      "out-for-delivery",
      "delivered",
    ];

    return (
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
          <b
            className="order-status"
            style={{
              color: isError ? "crimson" : statusColors[currentStatus] || "#0070f3",
            }}
          >
            {isLoading ? "⏳ Updating..." : isError ? "⚠️ Failed" : currentStatus}
          </b>
        </div>
        <div>Items: {order.items.map((i) => i.name).join(", ")}</div>
        <div>Total: ₹{order.total}</div>

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          {statusSteps.map((st) => {
            const isActive = st === currentStatus;
            const isDisabled =
              isLoading ||
              statusSteps.indexOf(st) < statusSteps.indexOf(currentStatus);

            return (
              <button
                key={st}
                onClick={() => updateStatus(order._id, st)}
                disabled={isDisabled}
                style={{
                  background: isActive
                    ? "green"
                    : isDisabled
                    ? "#ccc"
                    : "#007bff",
                  color: "white",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "none",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  fontSize: 13,
                  transition: "all 0.2s ease",
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isActive ? `✅ ${st}` : isLoading ? "..." : st}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 960, margin: "30px auto", padding: "0 16px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
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
          marginBottom: 20,
        }}
      >
        🔄 Refresh Orders
      </button>

      <section>
        {orders.length === 0 ? (
          <div>No orders found</div>
        ) : (
          orders.map(renderOrder)
        )}
      </section>
    </div>
  );
}

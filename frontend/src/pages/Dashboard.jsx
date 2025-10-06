// src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import OrderCard from '../components/OrderCard';

// at top of Dashboard.jsx (replace existing API_BASE line)
// fallback-safe API base (handles undefined)
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
  ? import.meta.env.VITE_API_BASE
  : 'https://whatsapp-saas-backend-f9ot.onrender.com';


export default function Dashboard() {
  const socketUrl = API_BASE || window.location.origin; // points to backend
  const { connected, joinOrder, on } = useSocket({ url: socketUrl });
  const [orders, setOrders] = useState([]);
  const [joinedIds, setJoinedIds] = useState(new Set());

  // fetch recent orders
  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE || ''}/api/orders`, {
        headers: { 'x-api-key': localStorage.getItem('admin_api_key') || '' }
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setOrders(data);
    } catch (e) {
      console.error('Load orders error', e);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Listen for socket updates and update local list
  useEffect(() => {
    const cleanup = on('orderStatusUpdate', (payload) => {
      setOrders((prev) => {
        const idx = prev.findIndex(o => String(o._id) === String(payload.orderId));
        if (idx === -1) {
          // optionally fetch the single order
          return prev;
        }
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
    <div style={{ maxWidth: 920, margin: '28px auto', padding: '0 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Merchant Dashboard</h1>
        <div>{connected ? <span style={{ color: 'green' }}>Live</span> : <span style={{ color: 'red' }}>Disconnected</span>}</div>
      </header>

      <div style={{ marginTop: 18 }}>
        <button onClick={loadOrders} style={{ padding: '8px 12px', borderRadius: 6 }}>Refresh orders</button>
      </div>

      <section style={{ marginTop: 18 }}>
        {orders.length === 0 ? <div>No orders yet</div> : orders.map(o => (
          <OrderCard key={o._id} order={o} onJoin={handleJoin} />
        ))}
      </section>
    </div>
  );
}

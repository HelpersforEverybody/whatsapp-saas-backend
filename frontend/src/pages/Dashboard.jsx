// src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import OrderCard from '../components/OrderCard';

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
  ? import.meta.env.VITE_API_BASE
  : (window.__API_BASE || 'https://whatsapp-saas-backend-f9ot.onrender.com');

const BUILD_TIME_API_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY)
  ? import.meta.env.VITE_API_KEY
  : null;

export default function Dashboard() {
  const socketUrl = API_BASE;
  const { connected, joinOrder, on } = useSocket({ url: socketUrl });
  const [orders, setOrders] = useState([]);
  const [joinedIds, setJoinedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_KEY = BUILD_TIME_API_KEY || localStorage.getItem('admin_api_key') || '';

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        headers: API_KEY ? { 'x-api-key': API_KEY } : {}
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`Failed to load: ${res.status} ${t}`);
      }
      const data = await res.json();
      setOrders(data);
      window.lastOrders = data;
    } catch (e) {
      console.error('Load orders error', e);
      setError(e.message || String(e));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, API_KEY]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // socket listener
  useEffect(() => {
    const cleanup = on('orderStatusUpdate', (payload) => {
      setOrders(prev => {
        const idx = prev.findIndex(o => String(o._id) === String(payload.orderId));
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

  const updateOrderStatus = useCallback(async (orderId, newStatus) => {
    // optimistic update
    setOrders(prev => prev.map(o => (String(o._id) === String(orderId) ? { ...o, status: newStatus } : o)));

    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {})
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${t}`);
      }
      const updated = await res.json();
      setOrders(prev => prev.map(o => (String(o._id) === String(orderId) ? updated : o)));
    } catch (err) {
      console.error('Failed to update status', err);
      await loadOrders();
      alert('Failed to update order status: ' + (err.message || err));
    }
  }, [API_BASE, API_KEY, loadOrders]);

  return (
    <div style={{ maxWidth: 920, margin: '28px auto', padding: '0 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Merchant Dashboard</h1>
          <div style={{ fontSize: 13, color: '#666' }}>Backend: <code>{API_BASE}</code></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>{connected ? <span style={{ color: 'green' }}>Live</span> : <span style={{ color: 'red' }}>Disconnected</span>}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{BUILD_TIME_API_KEY ? 'API key baked at build' : 'Using runtime API key'}</div>
        </div>
      </header>

      <div style={{ marginTop: 18 }}>
        <button onClick={loadOrders} style={{ padding: '8px 12px', borderRadius: 6 }}>Refresh orders</button>
        <span style={{ marginLeft: 12, color: '#444' }}>{loading ? 'Loading…' : `${orders.length} orders`}</span>
        {error && <span style={{ marginLeft: 12, color: 'crimson' }}>Error: {error}</span>}
      </div>

      <section style={{ marginTop: 18 }}>
        {orders.length === 0 ? <div>No orders yet</div> : orders.map(o => (
          <OrderCard
            key={o._id}
            order={o}
            onJoin={handleJoin}
            onUpdate={(status) => updateOrderStatus(o._id, status)}
          />
        ))}
      </section>
    </div>
  );
}

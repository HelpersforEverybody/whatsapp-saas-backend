// src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import OrderCard from '../components/OrderCard';

/**
 * Robust API base + key handling:
 * - Prefer VITE build-time env: import.meta.env.VITE_API_BASE / VITE_API_KEY
 * - Fallback to runtime window.__API_BASE or explicit backend URL
 * - Fallback for API key to localStorage admin_api_key (convenient for testing)
 */

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
  ? import.meta.env.VITE_API_BASE
  : (window.__API_BASE || 'https://whatsapp-saas-backend-f9ot.onrender.com');

const BUILD_TIME_API_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY)
  ? import.meta.env.VITE_API_KEY
  : null;

export default function Dashboard() {
  const socketUrl = API_BASE; // Socket server URL (use same origin/backend)
  const { connected, joinOrder, on } = useSocket({ url: socketUrl });
  const [orders, setOrders] = useState([]);
  const [joinedIds, setJoinedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // convenience input to set API key in localStorage (useful if you prefer runtime key)
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('admin_api_key') || BUILD_TIME_API_KEY || '');

  const API_KEY = BUILD_TIME_API_KEY || localStorage.getItem('admin_api_key') || '';

  // Expose for debugging in the console
  window.__DEBUG_API = { API_BASE, API_KEY };

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Dashboard.loadOrders -> API_BASE:', API_BASE, 'API_KEY present?', !!API_KEY);
      const res = await fetch(`${API_BASE}/api/orders`, {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to load orders: ${res.status} ${text}`);
      }
      const data = await res.json();
      setOrders(data);
      // also expose last orders for quick console debugging
      window.lastOrders = data;
      console.log('Loaded orders:', (data || []).length);
    } catch (e) {
      console.error('Load orders error', e);
      setError(e.message || String(e));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, API_KEY]);

  // initial load
  useEffect(() => { loadOrders(); }, [loadOrders]);

  // socket updates listener
  useEffect(() => {
    const cleanup = on('orderStatusUpdate', (payload) => {
      console.log('Socket orderStatusUpdate ->', payload);
      setOrders((prev) => {
        const idx = prev.findIndex(o => String(o._id) === String(payload.orderId));
        if (idx === -1) {
          // optionally fetch single order from API if missing
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

  const handleSetApiKey = () => {
    localStorage.setItem('admin_api_key', apiKeyInput || '');
    // Reload local values and fetch again
    window.location.reload();
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('admin_api_key');
    setApiKeyInput('');
    window.location.reload();
  };

  return (
    <div style={{ maxWidth: 920, margin: '28px auto', padding: '0 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Merchant Dashboard</h1>
          <div style={{ fontSize: 13, color: '#666' }}>
            Backend: <code style={{ color: '#111' }}>{API_BASE}</code>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ marginBottom: 6 }}>{connected ? <span style={{ color: 'green' }}>Live</span> : <span style={{ color: 'red' }}>Disconnected</span>}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{BUILD_TIME_API_KEY ? 'API key baked at build' : 'Using runtime API key'}</div>
        </div>
      </header>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={loadOrders} style={{ padding: '8px 12px', borderRadius: 6 }}>Refresh orders</button>
        <div style={{ fontSize: 13, color: '#444' }}>{loading ? 'Loading…' : `${orders.length} orders`}</div>
        {error && <div style={{ color: 'crimson', marginLeft: 12 }}>Error: {error}</div>}
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder="Paste admin API key here (for testing)"
          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', width: 420 }}
        />
        <button onClick={handleSetApiKey} style={{ padding: '8px 12px', borderRadius: 6 }}>Save key & reload</button>
        <button onClick={handleClearApiKey} style={{ padding: '8px 12px', borderRadius: 6 }}>Clear key</button>
      </div>

      <section style={{ marginTop: 18 }}>
        {orders.length === 0 ? <div>No orders yet</div> : orders.map(o => (
          <OrderCard key={o._id} order={o} onJoin={handleJoin} />
        ))}
      </section>
    </div>
  );
}

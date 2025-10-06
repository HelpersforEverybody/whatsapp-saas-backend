// src/components/OrderCard.jsx
import React from 'react';

export default function OrderCard({ order, onJoin }) {
  return (
    <div style={{
      border: '1px solid #e5e7eb', padding: 12, borderRadius: 8, marginBottom: 10,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    }}>
      <div>
        <div style={{ fontWeight: 600 }}>{order.customerName} — {order.phone}</div>
        <div style={{ fontSize: 13, color: '#555' }}>Status: <strong>{order.status}</strong></div>
        <div style={{ fontSize: 13, color: '#555' }}>Total: ₹{order.total}</div>
        <div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
          {order.items?.map((it, i) => (<div key={i}>{it.name} x{it.qty}</div>))}
        </div>
      </div>

      <div>
        <button onClick={() => onJoin(order._id)} style={{
          padding: '8px 12px', borderRadius: 6, border: 'none', background: '#111827', color: '#fff'
        }}>
          Live
        </button>
      </div>
    </div>
  );
}

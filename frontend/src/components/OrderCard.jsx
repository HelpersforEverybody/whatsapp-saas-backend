// src/components/OrderCard.jsx
import React from 'react';

export default function OrderCard({ order, onJoin = () => {}, onUpdate = () => {} }) {
  const { _id, customerName, phone, items = [], status, total, createdAt } = order;

  const canUpdateTo = (target) => {
    return status !== target;
  };

  return (
    <div data-order-id={_id} style={{
      border: '1px solid #eee',
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
      boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <div style={{ fontWeight: 700 }}>{customerName} <small style={{ color: '#666', marginLeft: 8 }}>{phone}</small></div>
          <div style={{ fontSize: 13, color: '#444', marginTop: 6 }}>
            {items.map((it, i) => <span key={i}>{it.name} x{it.qty}{i < items.length - 1 ? ', ' : ''}</span>)}
          </div>
          <div style={{ fontSize: 12, color: '#777', marginTop: 6 }}>Total: ₹{total} • Created: {new Date(createdAt).toLocaleString()}</div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            Status: <strong className="order-status">{status}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 6 }}>
            <button onClick={() => onJoin(_id)} style={{ padding: '6px 8px', borderRadius: 6 }}>Join</button>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              disabled={!canUpdateTo('accepted')}
              onClick={() => onUpdate('accepted')}
              style={{ padding: '6px 10px', borderRadius: 6 }}
            >Accept</button>

            <button
              disabled={!canUpdateTo('packed')}
              onClick={() => onUpdate('packed')}
              style={{ padding: '6px 10px', borderRadius: 6 }}
            >Packed</button>

            <button
              disabled={!canUpdateTo('out-for-delivery')}
              onClick={() => onUpdate('out-for-delivery')}
              style={{ padding: '6px 10px', borderRadius: 6 }}
            >Out for delivery</button>

            <button
              disabled={!canUpdateTo('delivered')}
              onClick={() => onUpdate('delivered')}
              style={{ padding: '6px 10px', borderRadius: 6 }}
            >Delivered</button>
          </div>
        </div>
      </div>
    </div>
  );
}

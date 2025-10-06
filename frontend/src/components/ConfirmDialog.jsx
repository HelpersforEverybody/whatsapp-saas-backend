// src/components/ConfirmDialog.jsx
import React from "react";

/**
 * Props:
 *  - open: boolean
 *  - title: string
 *  - message: string
 *  - onCancel: fn
 *  - onConfirm: fn
 */
export default function ConfirmDialog({ open, title, message, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", left: 0, top: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.35)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 99999
    }}>
      <div style={{ width: 420, background: "#fff", padding: 18, borderRadius: 8, boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <p style={{ color: "#333" }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button onClick={onCancel} style={{ padding: "8px 12px", background: "#eee", borderRadius: 6 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: "8px 12px", background: "#d9534f", color: "white", borderRadius: 6 }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// src/components/EditItemModal.jsx
import React, { useState, useEffect } from "react";

/**
 * Props:
 *  - open: boolean
 *  - onClose: fn()
 *  - onSaved: fn(item) -> called when saved
 *  - shopId: string (required for create)
 *  - item: object|null (if editing)
 *  - apiBase, apiKey (strings)
 */
export default function EditItemModal({ open, onClose, onSaved, shopId, item, apiBase, apiKey }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name || "");
      setPrice(String(item.price || ""));
      setAvailable(item.available !== false);
    } else {
      setName("");
      setPrice("");
      setAvailable(true);
    }
    setSaving(false);
  }, [item, open]);

  if (!open) return null;

  async function save() {
    if (!name.trim()) return alert("Name required");
    const payload = { name: name.trim(), price: Number(price || 0), available };
    setSaving(true);
    try {
      let res;
      if (item && item._id) {
        res = await fetch(`${apiBase}/api/shops/${item.shop || shopId}/items/${item._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${apiBase}/api/shops/${shopId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      onSaved && onSaved(json);
      onClose();
    } catch (e) {
      console.error("Save item error", e);
      alert("Failed to save item");
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: "fixed", left: 0, top: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.35)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 99999
    }}>
      <div style={{ width: 520, background: "#fff", padding: 18, borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>{item ? "Edit item" : "Add item"}</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8, marginTop: 10 }}>
          <input placeholder="Item name" value={name} onChange={(e)=>setName(e.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }} />
          <input placeholder="Price" type="number" value={price} onChange={(e)=>setPrice(e.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }} />
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={available} onChange={e=>setAvailable(e.target.checked)} />
            Available
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ padding: "8px 12px", background: "#eee", borderRadius: 6 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: "8px 12px", background: "#28a745", color: "white", borderRadius: 6 }}>
            {saving ? "Saving..." : (item ? "Update" : "Add")}
          </button>
        </div>
      </div>
    </div>
  );
}

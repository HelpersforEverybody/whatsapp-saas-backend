// frontend/src/components/EditItemModal.jsx
import React, { useState, useEffect } from "react";

/**
 * Props:
 *  - open: boolean
 *  - onClose: fn()
 *  - onSaved: fn(item)
 *  - shopId: string
 *  - item: object|null
 *  - apiBase, apiKey
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-3">{item ? "Edit item" : "Add item"}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            className="col-span-2 px-3 py-2 border rounded-md"
            placeholder="Item name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="px-3 py-2 border rounded-md"
            placeholder="Price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        <div className="mt-3">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="h-4 w-4" />
            <span className="text-sm">Available</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-green-600 text-white">
            {saving ? "Saving..." : item ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

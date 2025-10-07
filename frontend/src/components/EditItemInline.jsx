// EditItemInline.jsx
import React, { useState } from "react";

/**
 * Inline editor for a single menu item.
 * Props:
 *  - item: { _id, name, price, available, externalId }
 *  - onSave(updatedItem) -> called after successful save
 *  - onCancel()
 *  - onDelete() optional (if you want delete handled here)
 *  - onToggle() optional (toggle availability)
 *  - apiSave: async function(updatedFields) that performs API call and returns updated item
 */
export default function EditItemInline({ item, onSave, onCancel, apiSave }) {
  const [editing, setEditing] = useState(true);
  const [name, setName] = useState(item.name || "");
  const [price, setPrice] = useState(item.price || 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const updated = await apiSave({ name: name.trim(), price: Number(price || 0) });
      setSaving(false);
      setEditing(false);
      if (onSave) onSave(updated);
    } catch (err) {
      setSaving(false);
      setError((err && err.message) || "Failed to save");
    }
  }

  function handleCancel() {
    setEditing(false);
    if (onCancel) onCancel();
  }

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded border">
      <div className="space-y-2">
        <input
          className="w-full p-2 border rounded"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name"
        />
        <input
          className="w-full p-2 border rounded"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price"
          type="number"
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex gap-2 mt-1">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-3 py-1 bg-yellow-500 text-white rounded disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={handleCancel} className="px-3 py-1 border rounded">Cancel</button>
        </div>
      </div>
    </div>
  );
}

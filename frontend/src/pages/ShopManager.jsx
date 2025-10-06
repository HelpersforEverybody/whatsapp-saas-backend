// src/pages/ShopManager.jsx
import React, { useState, useEffect } from "react";
import EditItemModal from "../components/EditItemModal";
import ConfirmDialog from "../components/ConfirmDialog";

const API_BASE = import.meta.env.VITE_API_BASE || "https://whatsapp-saas-backend-f9ot.onrender.com";
const API_KEY = import.meta.env.VITE_API_KEY || localStorage.getItem("admin_api_key") || "";

export default function ShopManager() {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  // load shops
  async function loadShops() {
    try {
      const res = await fetch(`${API_BASE}/api/shops`);
      if (!res.ok) throw new Error("Failed");
      setShops(await res.json());
    } catch (e) {
      console.error("Load shops error", e);
    }
  }

  useEffect(() => { loadShops(); }, []);

  // load menu for shopId
  async function loadMenu(shopId) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      if (!res.ok) throw new Error("Failed");
      const items = await res.json();
      setMenu(items);
      setSelectedShop(shopId);
    } catch (e) {
      console.error("Load menu error", e);
      alert("Failed to load menu");
    } finally {
      setLoading(false);
    }
  }

  // open add item (with shop selected)
  function openAdd() {
    if (!selectedShop) return alert("Select a shop first (View Menu).");
    setEditItem(null);
    setEditOpen(true);
  }

  // open edit
  function openEdit(item) {
    setEditItem(item);
    setEditOpen(true);
  }

  // after saved (add or edit)
  function onSavedItem(saved) {
    // refresh menu
    if (selectedShop) loadMenu(selectedShop);
  }

  // delete flow
  function askDelete(item) {
    setPendingDelete(item);
    setConfirmOpen(true);
  }

  async function doDeleteConfirmed() {
    if (!pendingDelete) return;
    const item = pendingDelete;
    setConfirmOpen(false);
    try {
      const res = await fetch(`${API_BASE}/api/shops/${selectedShop}/items/${item._id}`, {
        method: "DELETE",
        headers: { "x-api-key": API_KEY }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // refresh
      loadMenu(selectedShop);
      setPendingDelete(null);
    } catch (e) {
      console.error("Delete item error", e);
      alert("Failed to delete item");
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "30px auto", padding: "0 16px" }}>
      <h1>🛍 Shops & Menu Manager</h1>

      <section style={{ marginTop: 16 }}>
        <h3>Existing Shops</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {shops.length === 0 ? <div>No shops yet</div> : shops.map(s => (
            <div key={s._id} style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <b>{s.name}</b><div style={{ fontSize: 12, color: "#666" }}>{s.phone}</div>
              </div>
              <div>
                <button onClick={() => loadMenu(s._id)} style={{ marginRight: 8, padding: "6px 10px" }}>View Menu</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* menu area */}
      {selectedShop && (
        <section style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Menu for shop</h3>
            <div>
              <button onClick={() => { loadMenu(selectedShop); }} style={{ marginRight: 8 }}>Refresh</button>
              <button onClick={openAdd} style={{ background: "#28a745", color: "white", padding: "8px 12px", borderRadius: 6 }}>Add item</button>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {loading ? <div>Loading...</div> :
              menu.length === 0 ? <div>No items yet</div> :
              <div style={{ display: "grid", gap: 10 }}>
                {menu.map(it => (
                  <div key={it._id} style={{ border: "1px solid #eee", padding: 12, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{it.name} <span style={{ fontSize: 12, color: "#666" }}>({it.externalId||"—"})</span></div>
                      <div style={{ fontSize: 13, color: "#444" }}>₹{it.price} • {it.available ? "Available" : "Unavailable"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEdit(it)} style={{ padding: "6px 10px" }}>Edit</button>
                      <button onClick={() => askDelete(it)} style={{ padding: "6px 10px", background: "#d9534f", color: "white", borderRadius: 6 }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        </section>
      )}

      <EditItemModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={onSavedItem}
        shopId={selectedShop}
        item={editItem}
        apiBase={API_BASE}
        apiKey={API_KEY}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Delete menu item"
        message={pendingDelete ? `Delete ${pendingDelete.name}? This cannot be undone.` : ""}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doDeleteConfirmed}
      />
    </div>
  );
}

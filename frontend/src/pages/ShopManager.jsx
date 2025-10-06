// frontend/src/pages/ShopManager.jsx
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

  const [toast, setToast] = useState(null);
  function showToast(msg, ms = 2500) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  // load shops
  async function loadShops() {
    try {
      const res = await fetch(`${API_BASE}/api/shops`);
      if (!res.ok) throw new Error("Failed");
      setShops(await res.json());
    } catch (e) {
      console.error("Load shops error", e);
      showToast("Failed to load shops");
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
      showToast("Failed to load menu");
    } finally {
      setLoading(false);
    }
  }

  // open add item (with shop selected)
  function openAdd() {
    if (!selectedShop) return showToast("Select a shop first (View Menu).");
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
    if (selectedShop) {
      loadMenu(selectedShop);
      showToast("Item saved");
    }
  }

  // delete flow
  function askDelete(item) {
    setPendingDelete(item);
    setConfirmOpen(true);
  }

  async function doDeleteConfirmed() {
    if (!pendingDelete || !selectedShop) return;
    const item = pendingDelete;
    setConfirmOpen(false);
    try {
      const res = await fetch(`${API_BASE}/api/shops/${selectedShop}/items/${item._id}`, {
        method: "DELETE",
        headers: { "x-api-key": API_KEY }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // refresh
      await loadMenu(selectedShop);
      setPendingDelete(null);
      showToast("Item deleted");
    } catch (e) {
      console.error("Delete item error", e);
      showToast("Failed to delete item");
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">🛍 Shops & Menu Manager</h1>
      </div>

      <section className="mb-6">
        <h3 className="text-lg font-medium mb-3">Existing Shops</h3>
        <div className="space-y-3">
          {shops.length === 0 ? (
            <div className="text-sm text-gray-500">No shops yet</div>
          ) : (
            shops.map((s) => (
              <div key={s._id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-gray-500">{s.phone}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadMenu(s._id)}
                    className="px-3 py-1 rounded-md border bg-white text-gray-700 hover:bg-gray-50"
                  >
                    View Menu
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {selectedShop && (
        <section className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Menu for shop</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => loadMenu(selectedShop)} className="px-3 py-1 rounded-md bg-gray-100">Refresh</button>
              <button onClick={openAdd} className="px-3 py-1 rounded-md bg-green-600 text-white">Add item</button>
            </div>
          </div>

          <div>
            {loading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : menu.length === 0 ? (
              <div className="text-sm text-gray-500">No items yet</div>
            ) : (
              <div className="space-y-3">
                {menu.map(it => (
                  <div key={it._id} className="flex items-center justify-between p-3 rounded-md border bg-white">
                    <div>
                      <div className="font-semibold">{it.name} <span className="text-xs text-gray-400">({it.externalId || "—"})</span></div>
                      <div className="text-sm text-gray-600">₹{it.price} • {it.available ? "Available" : "Unavailable"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(it)} className="px-3 py-1 rounded-md border hover:bg-gray-50">Edit</button>
                      <button onClick={() => askDelete(it)} className="px-3 py-1 rounded-md bg-red-600 text-white">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

      {toast && (
        <div className="fixed right-4 bottom-4 bg-blue-600 text-white px-4 py-2 rounded-md shadow">
          {toast}
        </div>
      )}
    </div>
  );
}

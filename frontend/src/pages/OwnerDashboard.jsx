// frontend/src/pages/OwnerDashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import { apiFetch, getApiBase } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";

export default function OwnerDashboard() {
  const API_BASE = getApiBase();
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const [newItem, setNewItem] = useState({ name: "", price: 0 });

  // to handle inline edits: track editing id -> {name, price}
  const [editing, setEditing] = useState({});

  function logout() {
    localStorage.removeItem("merchant_token");
    navigate("/merchant-login");
  }

  const loadMyShops = useCallback(async () => {
    setLoading(true);
    try {
      // server: /api/me/shops (if available) is best, otherwise call /api/shops and filter
      // We'll try /api/me/shops first
      let res = await apiFetch("/api/me/shops");
      if (!res.ok) {
        // fallback: /api/shops (public) then filter by owner if owner id provided by JWT
        const fallback = await apiFetch("/api/shops");
        if (!fallback.ok) throw new Error("Failed to load shops");
        const data = await fallback.json();
        setShops(data);
        if (data.length) setSelectedShop(data[0]);
      } else {
        const data = await res.json();
        setShops(data);
        if (data.length) setSelectedShop(data[0]);
      }
    } catch (e) {
      console.error("Load shops error", e);
      alert("Failed to load your shops (re-login if needed)");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMenuForShop = useCallback(async (shopId) => {
    if (!shopId) return setMenu([]);
    try {
      // Owner should use owner-only endpoint if available, otherwise public menu
      const res = await apiFetch(`/api/shops/${shopId}/menu`);
      if (!res.ok) {
        // fallback to public fetch without auth
        const fallback = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
        if (!fallback.ok) throw new Error("Failed to load menu");
        const data = await fallback.json();
        setMenu(data);
        return;
      }
      const data = await res.json();
      setMenu(data);
    } catch (e) {
      console.error("Load menu error", e);
      setMenu([]);
      // don't alert too often
    }
  }, [API_BASE]);

  const loadOrdersForShop = useCallback(async (shopId) => {
    if (!shopId) return setOrders([]);
    try {
      const res = await apiFetch(`/api/shops/${shopId}/orders`);
      if (!res.ok) {
        // show no orders or message
        setOrders([]);
        return;
      }
      const data = await res.json();
      setOrders(data);
    } catch (e) {
      console.error("Load orders error", e);
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("merchant_token");
    if (!token) {
      navigate("/merchant-login");
      return;
    }
    loadMyShops();
  }, [loadMyShops, navigate]);

  useEffect(() => {
    if (selectedShop && selectedShop._id) {
      loadMenuForShop(selectedShop._id);
      loadOrdersForShop(selectedShop._id);
    } else {
      setMenu([]);
      setOrders([]);
    }
  }, [selectedShop, loadMenuForShop, loadOrdersForShop]);

  // Add new item
  async function addItem() {
    if (!selectedShop) return alert("Select a shop");
    if (!newItem.name) return alert("Item name required");
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newItem.name, price: Number(newItem.price || 0) })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.status);
      }
      await loadMenuForShop(selectedShop._id);
      setNewItem({ name: "", price: 0 });
    } catch (e) {
      console.error("Save item error", e);
      alert("Save item error");
    }
  }

  // Delete item
  async function deleteItem(item) {
    if (!selectedShop) return;
    if (!confirm(`Delete item "${item.name}"?`)) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.status);
      }
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error("Delete item error", e);
      alert("Delete failed");
    }
  }

  // Toggle availability (Enable / Disable)
  async function toggleAvailability(item) {
    if (!selectedShop) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.status);
      }
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error("Toggle error", e);
      alert("Failed to toggle availability");
    }
  }

  // Start editing (setup editing state)
  function startEdit(item) {
    setEditing((s) => ({ ...s, [item._id]: { name: item.name, price: item.price } }));
  }
  // Cancel editing
  function cancelEdit(item) {
    setEditing((s) => {
      const copy = { ...s };
      delete copy[item._id];
      return copy;
    });
  }
  // Save edited item inline
  async function saveEdit(item) {
    if (!selectedShop) return;
    const e = editing[item._1d] || editing[item._id];
    const payload = editing[item._id];
    if (!payload) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: payload.name, price: Number(payload.price || 0) })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.status);
      }
      cancelEdit(item);
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error("Save edit error", e);
      alert("Failed to save changes");
    }
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto bg-white p-6 rounded shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Owner Dashboard</h2>
          <div>
            <button onClick={logout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-medium mb-2">Your Shops</h3>
            {loading ? <div>Loading...</div> : shops.length === 0 ? <div>No shops</div> :
              shops.map(s => (
                <div key={s._id}
                     className={`p-3 mb-2 border rounded cursor-pointer ${selectedShop && selectedShop._id === s._id ? "bg-blue-50" : ""}`}
                     onClick={() => setSelectedShop(s)}>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.phone}</div>
                </div>
              ))
            }

            <div className="mt-4 border-t pt-3">
              <h4 className="font-medium mb-2">Add Item to Selected Shop</h4>
              <input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} placeholder="Item name" className="w-full p-2 border rounded my-2" />
              <input value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} placeholder="Price" type="number" className="w-full p-2 border rounded my-2" />
              <button onClick={addItem} className="px-4 py-2 bg-green-600 text-white rounded">Add item</button>
            </div>
          </div>

          <div className="col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium">Orders for {selectedShop ? selectedShop.name : "—"}</h3>
                {orders.length === 0 ? <div className="text-sm text-gray-500">No orders</div> :
                  <div className="space-y-3">
                    {orders.map(o => (
                      <div key={o._id} className="p-3 border rounded bg-white">
                        <div className="font-medium">Order #{String(o._id).slice(0,6)} — <span className="text-sm">{o.status}</span></div>
                        <div className="text-sm">{o.items.map(i => `${i.name} x${i.qty}`).join(", ")}</div>
                        <div className="text-sm font-semibold mt-1">₹{o.total}</div>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>

            <h3 className="font-medium mb-3">Menu for {selectedShop ? selectedShop.name : "—"}</h3>
            {menu.length === 0 ? <div>No items</div> :
              <div className="space-y-3">
                {menu.map(item => {
                  const ed = editing[item._id];
                  return (
                    <div key={item._id} className="p-3 border rounded bg-white">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{item.name} • ₹{item.price}</div>
                          <div className="text-xs text-gray-500">id: {String(item.externalId || item._id).slice(0,20)}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleAvailability(item)}
                            className={`px-3 py-1 rounded ${item.available ? "bg-green-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                            {item.available ? "Enabled" : "Disabled"}
                          </button>

                          {!ed ? (
                            <>
                              <button onClick={() => startEdit(item)} className="px-3 py-1 bg-yellow-400 rounded">Edit</button>
                              <button onClick={() => deleteItem(item)} className="px-3 py-1 bg-gray-300 rounded">Delete</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => saveEdit(item)} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
                              <button onClick={() => cancelEdit(item)} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* inline edit row */}
                      {ed && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                          <input className="p-2 border rounded col-span-2" value={ed.name} onChange={ev => setEditing(s => ({ ...s, [item._id]: { ...s[item._id], name: ev.target.value } }))} />
                          <input className="p-2 border rounded" type="number" value={ed.price} onChange={ev => setEditing(s => ({ ...s, [item._id]: { ...s[item._id], price: ev.target.value } }))} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

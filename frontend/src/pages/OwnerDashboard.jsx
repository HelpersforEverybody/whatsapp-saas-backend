// frontend/src/pages/OwnerDashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import { apiFetch, getApiBase } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";

const STATUSES = ["received", "accepted", "packed", "out-for-delivery", "delivered"];

export default function OwnerDashboard() {
  const API_BASE = getApiBase();
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", price: 0 });
  const [editing, setEditing] = useState({}); // inline edits

  function logout() {
    localStorage.removeItem("merchant_token");
    navigate("/merchant-login");
  }

  const loadMyShops = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/me/shops");
      if (res.ok) {
        const data = await res.json();
        setShops(data);
        if (data.length) setSelectedShop(data[0]);
      } else {
        // fallback to public shops (won't filter by owner)
        const fallback = await apiFetch("/api/shops");
        if (fallback.ok) {
          const data = await fallback.json();
          setShops(data);
          if (data.length) setSelectedShop(data[0]);
        } else {
          throw new Error("Failed to load shops");
        }
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
      const res = await apiFetch(`/api/shops/${shopId}/menu`);
      if (!res.ok) {
        // fallback to public fetch
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
    }
  }, [API_BASE]);

  const loadOrdersForShop = useCallback(async (shopId) => {
    if (!shopId) return setOrders([]);
    try {
      const res = await apiFetch(`/api/shops/${shopId}/orders`);
      if (!res.ok) {
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

  // add item
  async function addItem() {
    if (!selectedShop) return alert("Select a shop");
    if (!newItem.name) return alert("Item name required");
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newItem.name, price: Number(newItem.price || 0) })
      });
      if (!res.ok) throw new Error(await res.text());
      await loadMenuForShop(selectedShop._id);
      setNewItem({ name: "", price: 0 });
    } catch (e) {
      console.error("Save item error", e);
      alert("Save item error");
    }
  }

  // delete item
  async function deleteItem(item) {
    if (!selectedShop) return;
    if (!confirm(`Delete item "${item.name}"?`)) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error("Delete item error", e);
      alert("Delete failed");
    }
  }

  // toggle availability
  async function toggleAvailability(item) {
    if (!selectedShop) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available })
      });
      if (!res.ok) throw new Error(await res.text());
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error("Toggle error", e);
      alert("Failed to toggle availability");
    }
  }

  // inline edit helpers
  function startEdit(item) {
    setEditing(s => ({ ...s, [item._id]: { name: item.name, price: item.price } }));
  }
  function cancelEdit(item) {
    setEditing(s => {
      const copy = { ...s };
      delete copy[item._id];
      return copy;
    });
  }
  async function saveEdit(item) {
    const payload = editing[item._id];
    if (!payload) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: payload.name, price: Number(payload.price || 0) })
      });
      if (!res.ok) throw new Error(await res.text());
      cancelEdit(item);
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error("Save edit error", e);
      alert("Failed to save changes");
    }
  }

  // update order status (with socket/emit handled by server)
  async function updateOrderStatus(orderId, newStatus) {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.status);
      }
      const updated = await res.json();
      // update local orders list
      setOrders(prev => prev.map(o => (String(o._id) === String(updated._id) ? updated : o)));
    } catch (e) {
      console.error("Update status error", e);
      alert("Failed to update status");
    }
  }

  // helper: determine if a status button should be disabled (can't go backwards)
  function isDisabledButton(btnStatus, currentStatus) {
    const orderIndex = STATUSES.indexOf(currentStatus);
    const btnIndex = STATUSES.indexOf(btnStatus);
    return btnIndex < orderIndex;
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto bg-white p-6 rounded shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Owner Dashboard</h2>
          <div><button onClick={logout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button></div>
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
            <div className="mb-4">
              <h3 className="font-medium">Orders for {selectedShop ? selectedShop.name : "—"}</h3>
              {orders.length === 0 ? <div className="text-sm text-gray-500">No orders</div> :
                <div className="space-y-3">
                  {orders.map(o => (
                    <div key={o._id} className="p-3 border rounded bg-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">Order #{String(o._id).slice(0,6)} — <span className="text-sm">{o.status}</span></div>
                          <div className="text-sm">{o.items.map(i => `${i.name} x${i.qty}`).join(", ")}</div>
                          <div className="text-sm font-semibold mt-1">₹{o.total}</div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {/* Status action buttons */}
                          <div className="flex gap-2">
                            {STATUSES.map(st => {
                              const active = st === o.status;
                              const disabled = isDisabledButton(st, o.status);
                              return (
                                <button
                                  key={st}
                                  onClick={() => updateOrderStatus(o._id, st)}
                                  disabled={disabled}
                                  className={`px-2 py-1 rounded text-sm ${active ? "bg-green-600 text-white" : disabled ? "bg-gray-200 text-gray-600" : "bg-blue-600 text-white"}`}
                                >
                                  {active ? `✅ ${st}` : st}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              }
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

                      {ed && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                          <input className="p-2 border rounded col-span-2" value={ed.name}
                                 onChange={ev => setEditing(s => ({ ...s, [item._id]: { ...s[item._id], name: ev.target.value } }))} />
                          <input className="p-2 border rounded" type="number" value={ed.price}
                                 onChange={ev => setEditing(s => ({ ...s, [item._id]: { ...s[item._id], price: ev.target.value } }))} />
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

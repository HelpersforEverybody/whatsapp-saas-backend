// OwnerDashboard.jsx
import React, { useEffect, useState } from "react";
import { apiFetch, getApiBase } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";
import EditItemInline from "../components/EditItemInline";

export default function OwnerDashboard() {
  const API_BASE = getApiBase();
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", price: 0 });
  const [editingItemId, setEditingItemId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("merchant_token");
    if (!token) {
      navigate("/merchant-login");
      return;
    }
    loadShops();
  }, []);

  useEffect(() => {
    if (selectedShop && selectedShop._id) {
      loadOrdersForShop(selectedShop._id);
      loadMenuForShop(selectedShop._id);
    } else {
      setOrders([]);
      setItems([]);
    }
  }, [selectedShop]);

  async function loadShops() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/me/shops");
      if (!res.ok) {
        if (res.status === 401) {
          alert("Session expired, please login again.");
          localStorage.removeItem("merchant_token");
          navigate("/merchant-login");
          return;
        }
        throw new Error("Failed to load shops");
      }
      const data = await res.json();
      setShops(data || []);
      if (data && data.length) setSelectedShop(data[0]);
    } catch (e) {
      console.error("Load shops error", e);
      alert("Failed to load your shops (re-login if needed)");
    } finally {
      setLoading(false);
    }
  }

  async function loadOrdersForShop(shopId) {
    try {
      const res = await apiFetch(`/api/shops/${shopId}/orders`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          alert("Session expired or forbidden — please login again.");
          localStorage.removeItem("merchant_token");
          navigate("/merchant-login");
          return;
        }
        throw new Error("Failed to load orders");
      }
      const data = await res.json();
      setOrders(data || []);
    } catch (e) {
      console.error("Load orders for shop failed", e);
      alert("Load orders for shop failed");
    }
  }

  async function loadMenuForShop(shopId) {
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      setItems(data || []);
    } catch (e) {
      console.error("Load menu error", e);
      alert("Failed to load menu for shop");
    }
  }

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
        alert("Add item failed: " + (txt || res.status));
        return;
      }
      const item = await res.json();
      setItems(prev => [item, ...prev]);
      setNewItem({ name: "", price: 0 });
    } catch (e) {
      console.error(e);
      alert("Network error");
    }
  }

  async function deleteItem(itemId) {
    if (!selectedShop) return;
    if (!confirm("Delete this item?")) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setItems(prev => prev.filter(i => i._id !== itemId));
    } catch (e) {
      console.error("Delete item error", e);
      alert("Delete failed");
    }
  }

  async function toggleItem(itemId) {
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${itemId}/toggle`, { method: "POST" });
      if (!res.ok) throw new Error("Toggle failed");
      const updated = await res.json();
      setItems(prev => prev.map(i => (i._id === updated._id ? updated : i)));
    } catch (e) {
      console.error("Toggle item error", e);
      alert("Toggle failed");
    }
  }

  // When clicking Edit -> show inline editor under that item
  function startEdit(itemId) {
    setEditingItemId(itemId);
  }
  function cancelEdit() {
    setEditingItemId(null);
  }

  async function saveEditedItem(itemId, fields) {
    try {
      // call server
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Save failed");
      }
      const updated = await res.json();
      setItems(prev => prev.map(i => (i._id === updated._id ? updated : i)));
      setEditingItemId(null);
    } catch (e) {
      console.error("Save item error", e);
      throw e;
    }
  }

  // update order status
  async function updateStatus(orderId, newStatus) {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to update status");
      }
      const updated = await res.json();
      setOrders(prev => prev.map(o => (o._id === updated._id ? { ...o, status: updated.status } : o)));
    } catch (e) {
      console.error("Update status error", e);
      alert("Failed to update status");
    }
  }

  function logout() {
    localStorage.removeItem("merchant_token");
    navigate("/merchant-login");
  }

  // helper: status ordering
  const statusOrder = ["received", "accepted", "packed", "out-for-delivery", "delivered"];

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Owner Dashboard</h2>
          <div><button onClick={logout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-medium mb-2">Your Shops</h3>
            {loading ? <div>Loading...</div> : shops.length === 0 ? <div>No shops</div> :
              shops.map(s => (
                <div key={s._id} onClick={() => setSelectedShop(s)} className={`p-3 mb-2 border rounded cursor-pointer ${selectedShop && selectedShop._id===s._id ? "bg-blue-50" : ""}`}>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.phone}</div>
                </div>
              ))
            }

            <div className="mt-4 border-t pt-3">
              <h4 className="font-medium mb-2">Add Item to Selected Shop</h4>
              <input value={newItem.name} onChange={e=>setNewItem({...newItem, name:e.target.value})} placeholder="Item name" className="w-full p-2 border rounded my-2"/>
              <input value={newItem.price} onChange={e=>setNewItem({...newItem, price:e.target.value})} placeholder="Price" type="number" className="w-full p-2 border rounded my-2"/>
              <button onClick={addItem} className="px-3 py-2 bg-green-600 text-white rounded">Add item</button>
            </div>
          </div>

          <div className="col-span-2">
            <h3 className="font-medium mb-2">Orders for {selectedShop ? selectedShop.name : "—"}</h3>
            {orders.length === 0 ? <div>No orders</div> :
              <div className="space-y-3 mb-4">
                {orders.map(o => (
                  <div key={o._id} className="p-3 border rounded bg-white flex justify-between items-center">
                    <div>
                      <div className="font-semibold">Order #{String(o._id).slice(0,6)} — <span className="text-sm text-gray-600">{o.status}</span></div>
                      <div className="text-sm text-gray-700">{o.items.map(i=>`${i.name} x${i.qty}`).join(", ")}</div>
                    </div>
                    <div className="flex gap-2">
                      {["accepted","packed","out-for-delivery","delivered"].map(st => {
                        const isActive = st === o.status;
                        const disabled = statusOrder.indexOf(st) < statusOrder.indexOf(o.status);
                        // show Accept as primary when not yet accepted
                        const btnClass = isActive ? "bg-green-600 text-white" : disabled ? "bg-gray-200 text-gray-600" : "bg-blue-600 text-white";
                        return (
                          <button
                            key={st}
                            onClick={() => updateStatus(o._id, st)}
                            disabled={disabled}
                            className={`px-3 py-1 rounded text-sm ${btnClass}`}
                          >
                            {isActive ? `✅ ${st}` : (st === "out-for-delivery" ? "Out for delivery" : st.charAt(0).toUpperCase() + st.slice(1))}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            }

            <h3 className="font-medium mb-2">Menu for {selectedShop ? selectedShop.name : "—"}</h3>
            {items.length === 0 ? <div>No items</div> :
              <div className="space-y-3">
                {items.map(it => (
                  <div key={it._id} className="p-3 border rounded bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{it.name} • ₹{it.price}</div>
                        <div className="text-xs text-gray-500">id: {it.externalId}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={()=>toggleItem(it._id)} className={`px-3 py-1 rounded ${it.available ? "bg-red-500 text-white" : "bg-gray-300"}`}>
                          {it.available ? "Disable" : "Enable"}
                        </button>
                        <button onClick={()=>startEdit(it._id)} className="px-3 py-1 rounded bg-yellow-400 text-white">Edit</button>
                        <button onClick={()=>deleteItem(it._id)} className="px-3 py-1 rounded bg-gray-300">Delete</button>
                      </div>
                    </div>

                    {/* Inline editor appears below the item when editingItemId === it._id */}
                    {editingItemId === it._id && (
                      <EditItemInline
                        item={it}
                        onCancel={cancelEdit}
                        apiSave={(fields)=> saveEditedItem(it._id, fields)}
                        onSave={(updated)=> {}}
                      />
                    )}
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

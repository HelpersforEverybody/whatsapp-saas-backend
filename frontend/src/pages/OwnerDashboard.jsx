// frontend/src/pages/OwnerDashboard.jsx
import React, { useEffect, useState } from "react";
import { getApiBase, apiFetch } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";

export default function OwnerDashboard() {
  const API_BASE = getApiBase();
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);

  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [newItem, setNewItem] = useState({ name: "", price: "" });
  const [editing, setEditing] = useState({}); // { [itemId]: { name, price, saving, error } }

  // token guard and basic redirect
  useEffect(() => {
    const token = localStorage.getItem("merchant_token");
    if (!token) {
      navigate("/merchant-login");
    }
  }, [navigate]);

  // load shops owned by merchant
  async function loadShops() {
    setLoadingShops(true);
    try {
      const res = await apiFetch("/api/me/shops");
      if (!res.ok) {
        throw new Error("Failed to load shops");
      }
      const data = await res.json();
      setShops(data || []);
      if (data && data.length && !selectedShop) setSelectedShop(data[0]);
    } catch (e) {
      console.error("Load shops error", e);
      alert("Failed to load your shops.");
    } finally {
      setLoadingShops(false);
    }
  }

  // load menu for a shop (all items)
  async function loadMenu(shopId) {
    if (!shopId) return setMenu([]);
    setLoadingMenu(true);
    try {
      // public endpoint returns items; but to edit we will send Authorization for owner routes
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`, {
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      setMenu(data || []);
    } catch (e) {
      console.error("Load menu error", e);
      alert("Failed to load menu for shop.");
    } finally {
      setLoadingMenu(false);
    }
  }

  // load orders for selected shop (owner-only)
  async function loadOrdersForShop(shopId) {
    if (!shopId) return setOrders([]);
    setLoadingOrders(true);
    try {
      const res = await apiFetch(`/api/shops/${shopId}/orders`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data || []);
    } catch (e) {
      console.error("Load orders for shop failed", e);
      // show friendly message
      // don't alert automatically — developer can inspect console
    } finally {
      setLoadingOrders(false);
    }
  }

  // add new item
  async function addItem() {
    if (!selectedShop) return alert("Select a shop first");
    if (!newItem.name) return alert("Item name required");
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newItem.name, price: Number(newItem.price || 0) })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Add item failed");
      }
      const item = await res.json();
      setMenu(prev => [item, ...prev]);
      setNewItem({ name: "", price: "" });
    } catch (e) {
      console.error("Add item failed", e);
      alert("Add item failed: " + (e.message || e));
    }
  }

  // toggle availability: PATCH /api/shops/:shopId/items/:itemId  { available: !available }
  async function toggleAvailability(item) {
    if (!selectedShop) return;
    const itemId = item._id;
    // optimistic UI update
    setMenu(prev => prev.map(it => (it._id === itemId ? { ...it, _updating: true } : it)));
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Failed to update item ${itemId}`);
      }
      const updated = await res.json();
      setMenu(prev => prev.map(it => (it._id === itemId ? { ...updated } : it)));
    } catch (e) {
      console.error("Toggle availability failed", e);
      alert("Toggle failed: " + (e.message || e));
      // revert optimistic flag
      setMenu(prev => prev.map(it => (it._id === itemId ? { ...it, _updating: false } : it)));
    }
  }

  // start editing item inline
  function startEdit(item) {
    setEditing(prev => ({ ...prev, [item._id]: { name: item.name, price: String(item.price), saving: false, error: null } }));
  }

  // cancel editing
  function cancelEdit(itemId) {
    setEditing(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  // save edited item
  async function saveEdit(itemId) {
    const ed = editing[itemId];
    if (!ed) return;
    setEditing(prev => ({ ...prev, [itemId]: { ...prev[itemId], saving: true, error: null } }));
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ed.name, price: Number(ed.price || 0) })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Save failed");
      }
      const updated = await res.json();
      setMenu(prev => prev.map(it => (it._id === itemId ? updated : it)));
      cancelEdit(itemId);
    } catch (e) {
      console.error("Save edit failed", e);
      setEditing(prev => ({ ...prev, [itemId]: { ...prev[itemId], saving: false, error: (e.message || "Failed") } }));
    }
  }

  // delete item
  async function deleteItem(itemId) {
    if (!selectedShop) return;
    if (!confirm("Delete this item?")) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Delete failed");
      }
      setMenu(prev => prev.filter(it => it._id !== itemId));
    } catch (e) {
      console.error("Delete failed", e);
      alert("Delete failed: " + (e.message || e));
    }
  }

  // when selectedShop changes, reload menu & orders
  useEffect(() => {
    if (selectedShop && selectedShop._id) {
      loadMenu(selectedShop._id);
      loadOrdersForShop(selectedShop._id);
    } else {
      setMenu([]);
      setOrders([]);
    }
  }, [selectedShop]);

  // initial load of shops
  useEffect(() => {
    loadShops();
  }, []);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto bg-white p-6 rounded shadow">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold">Owner Dashboard</h2>
            <div className="text-sm text-gray-600">Manage your shops, menu & orders</div>
          </div>
          <div>
            <button onClick={() => { localStorage.removeItem("merchant_token"); navigate("/merchant-login"); }} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="col-span-1">
            <h3 className="font-medium mb-2">Your Shops</h3>
            {loadingShops ? <div>Loading...</div> :
              shops.length === 0 ? <div>No shops found</div> :
                shops.map(s => (
                  <div key={s._id}
                    className={`p-3 mb-2 border rounded cursor-pointer ${selectedShop && selectedShop._id===s._id ? "bg-blue-50" : ""}`}
                    onClick={() => setSelectedShop(s)}>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.phone}</div>
                  </div>
                ))
            }

            <div className="mt-4 border-t pt-3">
              <h4 className="font-medium">Add Item to Selected Shop</h4>
              <input value={newItem.name} onChange={e=>setNewItem({...newItem, name:e.target.value})} placeholder="Item name" className="w-full p-2 border rounded my-2"/>
              <input value={newItem.price} onChange={e=>setNewItem({...newItem, price:e.target.value})} placeholder="Price" type="number" className="w-full p-2 border rounded my-2"/>
              <button onClick={addItem} className="px-3 py-2 bg-green-600 text-white rounded w-full">Add item</button>
            </div>
          </div>

          <div className="col-span-2">
            <h3 className="font-medium mb-2">Menu — {selectedShop ? selectedShop.name : "—"}</h3>

            {loadingMenu ? <div>Loading menu...</div> :
              menu.length === 0 ? <div>No items</div> :
                <div className="space-y-3">
                  {menu.map(item => {
                    const ed = editing[item._id];
                    return (
                      <div key={item._id} className="p-3 border rounded bg-white flex items-start justify-between gap-4">
                        <div className="flex-1">
                          {ed ? (
                            <div>
                              <input className="w-full p-2 border rounded mb-2" value={ed.name} onChange={e=>setEditing(prev=>({...prev,[item._id]:{...prev[item._id], name:e.target.value}}))} />
                              <input className="w-full p-2 border rounded mb-2" type="number" value={ed.price} onChange={e=>setEditing(prev=>({...prev,[item._id]:{...prev[item._id], price:e.target.value}}))} />
                              {ed.error && <div className="text-sm text-red-600 mb-1">{ed.error}</div>}
                              <div className="flex gap-2">
                                <button disabled={ed.saving} onClick={()=>saveEdit(item._id)} className="px-3 py-1 bg-blue-600 text-white rounded">{ed.saving ? "Saving..." : "Save"}</button>
                                <button onClick={()=>cancelEdit(item._id)} className="px-3 py-1 border rounded">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium">{item.name} <span className="text-xs text-gray-500">• ₹{item.price}</span></div>
                              <div className="text-xs text-gray-400">ID: {item.externalId}</div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div>
                            <button
                              onClick={() => toggleAvailability(item)}
                              disabled={!!item._updating}
                              className={`px-3 py-1 rounded ${item.available ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"}`}>
                              {item._updating ? "Updating..." : (item.available ? "Enabled" : "Disabled")}
                            </button>
                          </div>

                          <div className="flex gap-2">
                            {!ed && <button onClick={()=>startEdit(item)} className="px-3 py-1 border rounded">Edit</button>}
                            <button onClick={()=>deleteItem(item._id)} className="px-3 py-1 border rounded text-red-600">Delete</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </div>

          <div className="col-span-1">
            <h3 className="font-medium mb-2">Orders</h3>
            {loadingOrders ? <div>Loading orders...</div> :
              orders.length === 0 ? <div>No orders</div> :
                <div className="space-y-3">
                  {orders.map(o => (
                    <div key={o._id} className="p-2 border rounded bg-white">
                      <div className="font-medium">{o.customerName}</div>
                      <div className="text-xs text-gray-500">{o.phone}</div>
                      <div className="text-sm">{o.items.map(i=>`${i.name} x${i.qty}`).join(", ")}</div>
                      <div className="text-sm font-semibold">₹{o.total} • {o.status}</div>
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

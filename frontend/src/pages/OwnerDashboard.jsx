// frontend/src/pages/OwnerDashboard.jsx
import React, { useEffect, useState } from "react";
import { apiFetch, getApiBase } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";

export default function OwnerDashboard() {
  const API_BASE = getApiBase();
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [newItem, setNewItem] = useState({ name: "", price: 0 });
  const [loading, setLoading] = useState(false);

  // edit state (inline)
  const [editingItemId, setEditingItemId] = useState(null);
  const [editValues, setEditValues] = useState({ name: "", price: 0 });
  const [editError, setEditError] = useState("");

  function logout() {
    localStorage.removeItem("merchant_token");
    navigate("/merchant-login");
  }

  async function loadShops() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/shops");
      if (!res.ok) throw new Error("Failed to load shops");
      const data = await res.json();
      // Filter to shops owned by current merchant if owner field exists.
      // If your server provides /api/me/shops later, swap to that.
      const token = localStorage.getItem("merchant_token");
      let myShops = data;
      if (token) {
        // decode token minimally to get userId (we don't fully verify here)
        try {
          const p = JSON.parse(atob(token.split(".")[1]));
          const userId = p.userId;
          myShops = data.filter(s => s.owner && String(s.owner) === String(userId));
        } catch (e) {
          // fallback: show all if decode fails
        }
      }
      setShops(myShops);
      if (myShops.length) {
        setSelectedShop(myShops[0]);
      } else {
        setSelectedShop(null);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to load shops (re-login if needed)");
    } finally {
      setLoading(false);
    }
  }

  async function loadOrdersForShop(shopId) {
    if (!shopId) return setOrders([]);
    try {
      const res = await apiFetch(`/api/shops/${shopId}/orders`);
      if (!res.ok) {
        // show message but do not crash
        console.error("Load orders for shop failed", res.status);
        setOrders([]);
        return;
      }
      const data = await res.json();
      setOrders(data);
    } catch (e) {
      console.error(e);
      setOrders([]);
    }
  }

  async function loadMenuForShop(shopId) {
    if (!shopId) return setMenu([]);
    try {
      const res = await apiFetch(`/api/shops/${shopId}/menu`);
      if (!res.ok) {
        // fallback: empty
        setMenu([]);
        return;
      }
      const data = await res.json();
      setMenu(data);
    } catch (e) {
      console.error(e);
      setMenu([]);
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
      setNewItem({ name: "", price: 0 });
      // reload menu
      await loadMenuForShop(selectedShop._id);
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
      if (!res.ok) {
        const txt = await res.text();
        alert("Delete failed: " + (txt || res.status));
        return;
      }
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error(e);
      alert("Network error");
    }
  }

  async function toggleItemAvailability(item) {
    if (!selectedShop) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available })
      });
      if (!res.ok) {
        const txt = await res.text();
        alert("Toggle failed: " + (txt || res.status));
        return;
      }
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error(e);
      alert("Network error");
    }
  }

  // inline edit handlers
  function startEdit(item) {
    setEditingItemId(item._id);
    setEditValues({ name: item.name, price: item.price });
    setEditError("");
  }
  function cancelEdit() {
    setEditingItemId(null);
    setEditValues({ name: "", price: 0 });
    setEditError("");
  }

  async function saveEdit(itemId) {
    if (!selectedShop) return;
    if (!editValues.name) return setEditError("Name required");
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editValues.name, price: Number(editValues.price || 0) })
      });
      if (!res.ok) {
        const txt = await res.text();
        setEditError(txt || `Failed: ${res.status}`);
        return;
      }
      // success: reload menu and close editor
      await loadMenuForShop(selectedShop._id);
      cancelEdit();
    } catch (e) {
      console.error(e);
      setEditError("Network error");
    }
  }

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
      setMenu([]);
    }
  }, [selectedShop]);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Owner Dashboard</h2>
          <div className="flex gap-2">
            <button onClick={logout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1">
            <h3 className="font-medium mb-2">Your Shops</h3>
            {loading ? <div>Loading...</div> : shops.length === 0 ? <div>No shops</div> :
              shops.map(s => (
                <div key={s._id} className={`p-2 mb-2 border rounded cursor-pointer ${selectedShop && selectedShop._id===s._id ? "bg-blue-50" : ""}`} onClick={()=>setSelectedShop(s)}>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.phone}</div>
                </div>
              ))
            }

            <div className="mt-4 border-t pt-3">
              <h4 className="font-medium">Add Item to Selected Shop</h4>
              <input value={newItem.name} onChange={e=>setNewItem({...newItem, name:e.target.value})} placeholder="Item name" className="w-full p-2 border rounded my-2"/>
              <input value={newItem.price} onChange={e=>setNewItem({...newItem, price:e.target.value})} placeholder="Price" type="number" className="w-full p-2 border rounded my-2"/>
              <button onClick={addItem} className="px-3 py-2 bg-green-600 text-white rounded">Add item</button>
            </div>
          </div>

          <div className="col-span-2">
            <h3 className="font-medium mb-2">Orders for {selectedShop ? selectedShop.name : "—"}</h3>
            {orders.length === 0 ? <div>No orders</div> :
              <div className="space-y-3">
                {orders.map(o => (
                  <div key={o._id} className="p-3 border rounded bg-white flex justify-between">
                    <div>
                      <div className="font-medium">Order #{o.orderNumber || o._id.slice(0,6)} — <span className="lowercase">{o.status}</span></div>
                      <div className="text-sm text-gray-600">{o.items.map(i=>`${i.name} x${i.qty}`).join(", ")}</div>
                      <div className="text-sm text-gray-600">Total: ₹{o.total}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-sm">Status: <b>{o.status}</b></div>
                      <div className="flex gap-2">
                        <button onClick={()=>fetch(`${API_BASE}/api/orders/${o._id}/status`, { method: "PATCH", headers: { "Content-Type":"application/json", "Authorization": "Bearer "+localStorage.getItem("merchant_token") }, body: JSON.stringify({ status: "accepted" }) }).then(()=>loadOrdersForShop(selectedShop._id))} className="px-2 py-1 bg-blue-600 text-white rounded">Accept</button>
                        <button onClick={()=>fetch(`${API_BASE}/api/orders/${o._id}/status`, { method: "PATCH", headers: { "Content-Type":"application/json", "Authorization": "Bearer "+localStorage.getItem("merchant_token") }, body: JSON.stringify({ status: "packed" }) }).then(()=>loadOrdersForShop(selectedShop._id))} className="px-2 py-1 bg-gray-200 rounded">Packed</button>
                        <button onClick={()=>fetch(`${API_BASE}/api/orders/${o._id}/status`, { method: "PATCH", headers: { "Content-Type":"application/json", "Authorization": "Bearer "+localStorage.getItem("merchant_token") }, body: JSON.stringify({ status: "out-for-delivery" }) }).then(()=>loadOrdersForShop(selectedShop._id))} className="px-2 py-1 bg-gray-200 rounded">Out for delivery</button>
                        <button onClick={()=>fetch(`${API_BASE}/api/orders/${o._id}/status`, { method: "PATCH", headers: { "Content-Type":"application/json", "Authorization": "Bearer "+localStorage.getItem("merchant_token") }, body: JSON.stringify({ status: "delivered" }) }).then(()=>loadOrdersForShop(selectedShop._id))} className="px-2 py-1 bg-gray-200 rounded">Delivered</button>
                        <button onClick={()=>fetch(`${API_BASE}/api/orders/${o._id}/status`, { method: "PATCH", headers: { "Content-Type":"application/json", "Authorization": "Bearer "+localStorage.getItem("merchant_token") }, body: JSON.stringify({ status: "cancelled" }) }).then(()=>loadOrdersForShop(selectedShop._id))} className="px-2 py-1 bg-red-500 text-white rounded">Cancel</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            }

            <h3 className="font-medium mt-6 mb-2">Menu for {selectedShop ? selectedShop.name : "—"}</h3>
            {menu.length === 0 ? <div>No items</div> :
              <div className="space-y-3">
                {menu.map(item => (
                  <div key={item._id} className="p-3 border rounded bg-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{item.name} • ₹{item.price}</div>
                        <div className="text-xs text-gray-400">ID: {item.externalId || item._id}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>toggleItemAvailability(item)} className={`px-3 py-1 rounded ${item.available ? "bg-green-600 text-white":"bg-gray-300"}`}>{item.available ? "Enabled":"Disabled"}</button>
                        <button onClick={()=>startEdit(item)} className="px-3 py-1 rounded bg-yellow-400">Edit</button>
                        <button onClick={()=>deleteItem(item._id)} className="px-3 py-1 rounded bg-gray-300">Delete</button>
                      </div>
                    </div>

                    {/* inline edit area */}
                    {editingItemId === item._id && (
                      <div className="mt-3 border-t pt-3">
                        <div className="text-sm text-gray-700 mb-2">Edit item</div>
                        <input value={editValues.name} onChange={e=>setEditValues({...editValues, name:e.target.value})} placeholder="Name" className="w-full p-2 border rounded mb-2" />
                        <input value={editValues.price} onChange={e=>setEditValues({...editValues, price:e.target.value})} placeholder="Price" type="number" className="w-full p-2 border rounded mb-2" />
                        {editError && <div className="text-sm text-red-600 mb-2">{editError}</div>}
                        <div className="flex gap-2">
                          <button onClick={()=>saveEdit(item._id)} className="px-3 py-1 bg-green-600 text-white rounded">Save</button>
                          <button onClick={cancelEdit} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
                        </div>
                      </div>
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

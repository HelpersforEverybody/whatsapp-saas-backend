// frontend/src/pages/OwnerDashboard.jsx
import React, { useEffect, useState } from "react";
import { apiFetch, getApiBase } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";

/**
 * Owner dashboard:
 * - Shows only owner's shops (loaded via /api/me/shops using merchant token)
 * - Shows orders for selected shop (owner-only endpoint /api/shops/:shopId/orders)
 * - Shows menu for selected shop (/api/shops/:shopId/menu)
 * - Add item, edit, delete, toggle availability using owner endpoints
 *
 * This file displays orderNumber as 6-digit numeric when available:
 * Order #000123 (if order.orderNumber exists) else fallback short id.
 */

export default function OwnerDashboard() {
  const API_BASE = getApiBase();
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [newItem, setNewItem] = useState({ name: "", price: "" });
  const [loading, setLoading] = useState(false);

  function logout() {
    localStorage.removeItem("merchant_token");
    navigate("/merchant-login");
  }

  // helper: format order number (6 digits) or fallback
  function displayOrderLabel(order) {
    if (order.orderNumber || order.orderNumber === 0) {
      return `Order #${String(order.orderNumber).padStart(6, "0")}`;
    }
    // fallback to short id
    return `Order #${String(order._id || "").slice(0, 6)}`;
  }

  async function loadShops() {
    setLoading(true);
    try {
      // /api/me/shops requires merchant JWT; apiFetch attaches token
      const res = await apiFetch("/api/me/shops");
      if (!res.ok) {
        // token may be expired or invalid
        throw new Error("Failed to load shops");
      }
      const data = await res.json();
      setShops(data);
      if (data.length && !selectedShop) setSelectedShop(data[0]);
    } catch (e) {
      console.error("Failed to load shops", e);
      alert("Failed to load shops (re-login if needed)");
      // auto-redirect to login if unauthorized
      const token = localStorage.getItem("merchant_token");
      if (!token) navigate("/merchant-login");
    } finally {
      setLoading(false);
    }
  }

  async function loadOrdersForShop(shopId) {
    try {
      if (!shopId) {
        setOrders([]);
        return;
      }
      // requireOwner on backend; apiFetch will include merchant token
      const res = await apiFetch(`/api/shops/${shopId}/orders`);
      if (!res.ok) {
        throw new Error("Failed to load orders");
      }
      const data = await res.json();
      setOrders(data);
    } catch (e) {
      console.error("Load orders for shop failed", e);
      alert("Load orders for shop failed");
    }
  }

  async function loadMenuForShop(shopId) {
    try {
      if (!shopId) {
        setMenu([]);
        return;
      }
      // public endpoint okay
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      setMenu(data);
    } catch (e) {
      console.error("Load menu failed", e);
      alert("Failed to load menu");
    }
  }

  // Add item (owner)
  async function addItem() {
    if (!selectedShop) return alert("Select a shop");
    if (!newItem.name) return alert("Item name required");
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newItem.name, price: Number(newItem.price || 0) }),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert("Add item failed: " + (txt || res.status));
        return;
      }
      setNewItem({ name: "", price: "" });
      // reload menu
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error(e);
      alert("Network error adding item");
    }
  }

  async function toggleAvailability(item) {
    if (!selectedShop) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available }),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert("Toggle failed: " + (txt || res.status));
        return;
      }
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error(e);
      alert("Network error toggling item");
    }
  }

  async function deleteItem(item) {
    if (!selectedShop) return;
    if (!confirm("Delete this item?")) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const txt = await res.text();
        alert("Delete failed: " + (txt || res.status));
        return;
      }
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error(e);
      alert("Network error deleting item");
    }
  }

  async function editItem(item) {
    const name = prompt("New name", item.name);
    if (name === null) return;
    const priceStr = prompt("New price", String(item.price || 0));
    if (priceStr === null) return;
    const price = Number(priceStr || 0);
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price }),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert("Edit failed: " + (txt || res.status));
        return;
      }
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error(e);
      alert("Network error editing item");
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("merchant_token");
    if (!token) {
      navigate("/merchant-login");
      return;
    }
    loadShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedShop && selectedShop._id) {
      loadOrdersForShop(selectedShop._id);
      loadMenuForShop(selectedShop._id);
    } else {
      setOrders([]);
      setMenu([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                      <div className="font-medium">{displayOrderLabel(o)} — <span className="text-sm text-gray-600">{o.status}</span></div>
                      <div className="text-sm text-gray-600">{o.items.map(i=>`${i.name} x${i.qty}`).join(", ")}</div>
                      <div className="text-sm text-gray-600">₹{o.total}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-sm">Customer: <b>{o.customerName}</b></div>
                      <div className="flex gap-2">
                        <button onClick={()=>apiFetch(`/api/orders/${o._id}/status`, { method: "PATCH", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ status: "accepted" }) }).then(()=>loadOrdersForShop(selectedShop._id))} className="px-2 py-1 bg-blue-600 text-white rounded">Accept</button>
                        <button onClick={()=>apiFetch(`/api/orders/${o._id}/status`, { method: "PATCH", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ status: "packed" }) }).then(()=>loadOrdersForShop(selectedShop._id))} className="px-2 py-1 bg-gray-200 rounded">Packed</button>
                        <button onClick={()=>apiFetch(`/api/orders/${o._id}/status`, { method: "PATCH", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ status: "out-for-delivery" }) }).then(()=>loadOrdersForShop(selectedShop._id))} className="px-2 py-1 bg-gray-200 rounded">Out for delivery</button>
                        <button onClick={()=>apiFetch(`/api/orders/${o._id}/status`, { method: "PATCH", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ status: "delivered" }) }).then(()=>loadOrdersForShop(selectedShop._id))} className="px-2 py-1 bg-gray-200 rounded">Delivered</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            }

            <hr className="my-4" />

            <h3 className="font-medium mb-2">Menu for {selectedShop ? selectedShop.name : "—"}</h3>
            {menu.length === 0 ? <div>No items</div> :
              <div className="space-y-3">
                {menu.map(it => (
                  <div key={it._id} className="p-3 border rounded bg-white flex justify-between items-center">
                    <div>
                      <div className="font-medium">{it.name} • ₹{it.price}</div>
                      <div className="text-xs text-gray-500">ID: {it.externalId || it._id}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>toggleAvailability(it)} className={`px-3 py-1 rounded ${it.available ? "bg-green-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                        {it.available ? "Enabled" : "Disabled"}
                      </button>
                      <button onClick={()=>editItem(it)} className="px-3 py-1 bg-yellow-400 rounded">Edit</button>
                      <button onClick={()=>deleteItem(it)} className="px-3 py-1 bg-gray-300 rounded">Delete</button>
                    </div>
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

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
  const [newItem, setNewItem] = useState({ name: "", price: 0 });
  const [loading, setLoading] = useState(false);

  function logout() {
    localStorage.removeItem("merchant_token");
    navigate("/merchant-login");
  }

  async function loadShops() {
    setLoading(true);
    try {
      // public /api/shops returns all shops; owner-only shops can be filtered by querying for shops with owner = user,
      // but we kept a simple approach: call /api/shops and then filter by owner if returned (owner field exists)
      const res = await apiFetch("/api/shops");
      if (!res.ok) throw new Error("Failed to load shops");
      const data = await res.json();
      // filter to shops where owner is present and current user owns (server doesn't provide userId here).
      // Better: server could expose /api/me/shops — but for now, show shops (owner-created will include owner id)
      setShops(data);
      if (data.length) setSelectedShop(data[0]);
    } catch (e) {
      console.error(e);
      alert("Failed to load shops");
    } finally {
      setLoading(false);
    }
  }

  async function loadOrdersForShop(shopId) {
    try {
      const res = await apiFetch(`/api/shops/${shopId}/orders`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data);
    } catch (e) {
      console.error(e);
      alert("Failed to load orders for shop");
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
      alert("Item added");
      setNewItem({ name: "", price: 0 });
    } catch (e) {
      console.error(e);
      alert("Network error");
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
    } else {
      setOrders([]);
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
                      <div className="font-medium">{o.customerName} <span className="text-xs text-gray-500">• {o.phone}</span></div>
                      <div className="text-sm text-gray-600">{o.items.map(i=>`${i.name} x${i.qty}`).join(", ")}</div>
                      <div className="text-sm text-gray-600">Total: ₹{o.total}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-sm">Status: <b>{o.status}</b></div>
                      <div className="flex gap-2">
                        <button onClick={()=>fetch(`${API_BASE}/api/orders/${o._id}/status`, { method: "PATCH", headers: { "Content-Type":"application/json", "Authorization": "Bearer "+localStorage.getItem("merchant_token") }, body: JSON.stringify({ status: "accepted" }) }).then(()=>loadOrdersForShop(selectedShop._id))} className="px-2 py-1 bg-blue-600 text-white rounded">Accept</button>
                        <button onClick={()=>fetch(`${API_BASE}/api/orders/${o._id}/status`, { method: "PATCH", headers: { "Content-Type":"application/json", "Authorization": "Bearer "+localStorage.getItem("merchant_token") }, body: JSON.stringify({ status: "packed" }) }).then(()=>loadOrdersForShop(selectedShop._id))} className="px-2 py-1 bg-gray-200 rounded">Packed</button>
                      </div>
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

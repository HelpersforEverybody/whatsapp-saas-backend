// frontend/src/pages/OwnerDashboard.jsx
import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://whatsapp-saas-backend-f9ot.onrender.com";
const API_KEY = import.meta.env.VITE_API_KEY || localStorage.getItem("admin_api_key") || "";

export default function OwnerDashboard() {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [orders, setOrders] = useState([]);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState(0);

  useEffect(() => {
    loadShops();
  }, []);

  async function loadShops() {
    try {
      const res = await fetch(`${API_BASE}/api/shops`);
      if (!res.ok) throw new Error("Failed to load shops");
      const j = await res.json();
      setShops(j);
      if (j && j.length && !selectedShop) setSelectedShop(j[0]);
    } catch (e) {
      console.error("Failed to load shops", e);
      alert("Failed to load shops");
    }
  }

  async function loadOrdersForShop(shop) {
    if (!shop) return setOrders([]);
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shop._id}/orders`, {
        headers: { "x-api-key": API_KEY }
      });
      if (!res.ok) throw new Error("Failed to load orders");
      const j = await res.json();
      setOrders(j);
    } catch (e) {
      console.error("Failed to load orders for shop", e);
      setOrders([]);
      alert("Failed to load orders for shop");
    }
  }

  useEffect(() => {
    loadOrdersForShop(selectedShop);
    // eslint-disable-next-line
  }, [selectedShop]);

  async function addItem(e) {
    e && e.preventDefault();
    if (!selectedShop) return alert("Pick a shop first");
    if (!itemName) return alert("Enter item name");
    try {
      const res = await fetch(`${API_BASE}/api/shops/${selectedShop._id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ name: itemName, price: Number(itemPrice || 0) })
      });
      if (!res.ok) throw new Error("Failed to add item");
      const j = await res.json();
      alert("Item added: " + j.name);
      setItemName(""); setItemPrice(0);
    } catch (err) {
      console.error("Add item error", err);
      alert("Failed to add item");
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">Owner Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h3 className="font-medium mb-2">Your Shops</h3>
          <div className="space-y-2">
            {shops.map(s => (
              <div key={s._id} className={`p-3 border rounded cursor-pointer ${selectedShop && selectedShop._id === s._id ? "bg-blue-50" : ""}`} onClick={() => setSelectedShop(s)}>
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-gray-500">{s.phone}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2">
          <h3 className="font-medium">Orders for {selectedShop ? selectedShop.name : "— select a shop"}</h3>
          {orders.length === 0 ? <div className="text-sm text-gray-500">No orders</div> : (
            <div className="space-y-2">
              {orders.map(o => (
                <div key={o._id} className="p-3 border rounded">
                  <div className="font-semibold">{o.customerName} • {o.phone}</div>
                  <div className="text-sm">Status: {o.status} • Total: ₹{o.total}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <h4 className="font-medium mb-2">Add Item to Selected Shop</h4>
            <form onSubmit={addItem} className="space-y-2">
              <input placeholder="Item name" value={itemName} onChange={e=>setItemName(e.target.value)} className="w-full p-2 border rounded" />
              <input placeholder="Price" type="number" value={itemPrice} onChange={e=>setItemPrice(e.target.value)} className="w-full p-2 border rounded" />
              <button className="px-4 py-2 bg-green-600 text-white rounded">Add item</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

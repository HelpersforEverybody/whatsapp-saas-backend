// frontend/src/pages/ShopManager.jsx
import React, { useEffect, useState } from "react";
import { getApiBase } from "../hooks/useApi";

/**
 * Shop & Menu page (customer-facing)
 * - Left: select shop
 * - Right: menu for selected shop (shows availability)
 * - You place an order for multiple items: this implementation provides
 *   a simple cart per-shop. Add quantities to items and click "Place Order"
 *   (single order for multiple items).
 *
 * This file uses the public POST /api/orders so guest placing works.
 */

export default function ShopManager() {
  const API_BASE = getApiBase();
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    loadShops();
  }, []);

  async function loadShops() {
    try {
      const res = await fetch(`${API_BASE}/api/shops`);
      if (!res.ok) throw new Error("Failed to load shops");
      const data = await res.json();
      setShops(data);
      if (data.length && !selectedShop) setSelectedShop(data[0]);
    } catch (e) {
      console.error(e);
      alert("Cannot load shops");
    }
  }

  async function loadMenu(shopId) {
    if (!shopId) {
      setMenu([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      setMenu(data);
      // reset quantities
      const q = {};
      data.forEach(it => q[it._id] = 0);
      setQuantities(q);
    } catch (e) {
      console.error(e);
      alert("Failed to load menu");
    }
  }

  useEffect(() => {
    if (selectedShop && selectedShop._id) {
      loadMenu(selectedShop._id);
    } else setMenu([]);
  }, [selectedShop]);

  function updateQty(itemId, v) {
    const val = Math.max(0, Number(v || 0));
    setQuantities(q => ({ ...q, [itemId]: val }));
  }

  async function placeOrder() {
    if (!selectedShop) return alert("Select a shop");
    // gather items with qty > 0 and available
    const itemsToOrder = menu
      .filter(it => it.available && quantities[it._id] && quantities[it._id] > 0)
      .map(it => ({ name: it.name, qty: Number(quantities[it._id]), price: Number(it.price || 0) }));
    if (!itemsToOrder.length) return alert("Select at least one item");
    if (!customer.name || !customer.phone) return alert("Enter name and phone");

    setPlacing(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: selectedShop._id,
          customerName: customer.name,
          phone: customer.phone,
          items: itemsToOrder,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Order failed");
      }
      const data = await res.json();
      alert("Order placed! Order #: " + (data.orderNumber ? String(data.orderNumber).padStart(6, "0") : data._id.slice(0,6)));
      // reset quantities
      const q = {};
      menu.forEach(it => q[it._id] = 0);
      setQuantities(q);
    } catch (e) {
      console.error("Order failed:", e);
      alert("Order failed: " + (e.message || e));
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded shadow">
        <h2 className="text-2xl font-semibold mb-4">Shops & Menu Manager</h2>

        <div className="mb-4 p-4 border rounded bg-gray-50">
          <div className="grid grid-cols-2 gap-4">
            <input className="p-2 border rounded" placeholder="Your Name" value={customer.name} onChange={e=>setCustomer({...customer, name:e.target.value})}/>
            <input className="p-2 border rounded" placeholder="Your Phone (10 digits)" value={customer.phone} onChange={e=>setCustomer({...customer, phone:e.target.value.replace(/[^\d]/g,'').slice(0,10)})}/>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h3 className="font-medium mb-2">Available Shops</h3>
            {shops.map(s => (
              <div key={s._id} className={`p-4 mb-3 border rounded cursor-pointer ${selectedShop && selectedShop._id===s._id ? "bg-blue-50" : ""}`} onClick={()=>setSelectedShop(s)}>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-gray-500">{s.phone}</div>
                <div className="text-xs text-gray-400">{s.description}</div>
              </div>
            ))}
          </div>

          <div className="col-span-2">
            <h3 className="font-medium mb-2">Menu for {selectedShop ? selectedShop.name : "—"}</h3>
            {menu.length === 0 ? <div>No items</div> :
              <div className="space-y-3">
                {menu.map(it => (
                  <div key={it._id} className="p-3 border rounded bg-white flex items-center justify-between">
                    <div>
                      <div className="font-medium">{it.name} • ₹{it.price}</div>
                      <div className="text-xs text-gray-500">{it.available ? "Available" : "Unavailable"}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="number" min="0" value={quantities[it._id]||0} onChange={e=>updateQty(it._id, e.target.value)} disabled={!it.available} className="w-20 p-2 border rounded"/>
                    </div>
                  </div>
                ))}
              </div>
            }

            <div className="mt-6 flex justify-end">
              <button onClick={placeOrder} disabled={placing} className="px-4 py-2 bg-green-600 text-white rounded">
                {placing ? "Placing..." : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

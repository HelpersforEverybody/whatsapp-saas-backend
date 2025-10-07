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
  const [loadingShops, setLoadingShops] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", price: "" });

  // ensure logged in merchant
  useEffect(() => {
    const token = localStorage.getItem("merchant_token");
    if (!token) {
      navigate("/merchant-login");
    } else {
      loadMyShops();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when selected shop changes, load its menu + orders
  useEffect(() => {
    if (selectedShop && selectedShop._id) {
      loadMenu(selectedShop._id);
      loadOrdersForShop(selectedShop._id);
    } else {
      setMenu([]);
      setOrders([]);
    }
  }, [selectedShop]);

  // fetch owned shops via /api/me/shops (server must expose this route)
  async function loadMyShops() {
    setLoadingShops(true);
    try {
      const res = await apiFetch("/api/me/shops");
      if (!res.ok) {
        // if 401 or other error, force login
        if (res.status === 401) {
          localStorage.removeItem("merchant_token");
          navigate("/merchant-login");
          return;
        }
        throw new Error(`Failed to load shops (${res.status})`);
      }
      const data = await res.json();
      setShops(data);
      if (data && data.length) {
        // find previously selected shop id in query (optional) or choose first
        setSelectedShop(data[0]);
      } else {
        setSelectedShop(null);
      }
    } catch (err) {
      console.error("loadMyShops error", err);
      alert("Failed to load shops");
    } finally {
      setLoadingShops(false);
    }
  }

  // load menu for shopId
  async function loadMenu(shopId) {
    setLoadingMenu(true);
    try {
      const res = await apiFetch(`/api/shops/${shopId}/menu`);
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      setMenu(data);
    } catch (err) {
      console.error("loadMenu error", err);
      alert("Failed to load menu");
    } finally {
      setLoadingMenu(false);
    }
  }

  // load orders for shopId (owner-only endpoint)
  async function loadOrdersForShop(shopId) {
    setLoadingOrders(true);
    try {
      const res = await apiFetch(`/api/shops/${shopId}/orders`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to load orders (${res.status}) ${txt}`);
      }
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error("loadOrdersForShop error", err);
      alert("Failed to load orders for shop");
    } finally {
      setLoadingOrders(false);
    }
  }

  // add new menu item (owner only)
  async function addItem(e) {
    e && e.preventDefault();
    if (!selectedShop) return alert("Select a shop first");
    if (!newItem.name || newItem.name.trim() === "") return alert("Item name required");
    const price = Number(newItem.price || 0);
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newItem.name.trim(), price })
      });
      if (!res.ok) {
        const txt = await res.text().catch(()=>"");
        throw new Error(txt || `error ${res.status}`);
      }
      const added = await res.json();
      setMenu(prev => [added, ...prev]);
      setNewItem({ name: "", price: "" });
    } catch (err) {
      console.error("addItem error", err);
      alert("Add item failed: " + (err.message || err));
    }
  }

  // soft-delete (set available false) or edit item
  async function disableItem(itemId) {
    if (!selectedShop) return;
    if (!confirm("Disable (hide) this item?")) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: false })
      });
      if (!res.ok) throw new Error("Failed to disable item");
      // remove from local list
      setMenu(prev => prev.filter(i => String(i._id) !== String(itemId)));
    } catch (err) {
      console.error("disableItem error", err);
      alert("Failed to disable item");
    }
  }

  // update order status
  async function updateOrderStatus(orderId, status) {
    if (!selectedShop) return;
    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const t = await res.text().catch(()=>"");
        throw new Error(t || `status ${res.status}`);
      }
      await loadOrdersForShop(selectedShop._id);
    } catch (err) {
      console.error("updateOrderStatus error", err);
      alert("Failed to update order status");
    }
  }

  function logout() {
    localStorage.removeItem("merchant_token");
    navigate("/merchant-login");
  }

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
          {/* LEFT: Shops + Add Item form */}
          <div className="col-span-1">
            <h3 className="font-medium mb-2">Your Shops</h3>

            {loadingShops ? <div>Loading shops…</div> :
              shops.length === 0 ? <div>No shops found</div> :
              shops.map(s => (
                <div
                  key={s._id}
                  onClick={() => setSelectedShop(s)}
                  className={`p-3 mb-2 border rounded cursor-pointer ${selectedShop && selectedShop._id===s._id ? "bg-blue-50" : ""}`}
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.phone}</div>
                </div>
              ))
            }

            <div className="mt-4 border-t pt-3">
              <h4 className="font-medium mb-2">Add Item to Selected Shop</h4>
              <input value={newItem.name} onChange={e=>setNewItem({...newItem, name:e.target.value})} placeholder="Item name" className="w-full p-2 border rounded my-2"/>
              <input value={newItem.price} onChange={e=>setNewItem({...newItem, price:e.target.value})} placeholder="Price" type="number" className="w-full p-2 border rounded my-2"/>
              <div className="flex gap-2">
                <button onClick={addItem} className="px-3 py-2 bg-green-600 text-white rounded">Add item</button>
                <button onClick={()=>{ setNewItem({name:"", price:""}); }} className="px-3 py-2 border rounded">Clear</button>
              </div>
            </div>
          </div>

          {/* RIGHT: Orders + Menu */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Orders for {selectedShop ? selectedShop.name : "—"}</h3>
              <div className="text-sm text-gray-500">
                {selectedShop ? <span>Shop: {selectedShop.name}</span> : <span>Select a shop</span>}
              </div>
            </div>

            {/* Orders list */}
            <div className="mb-6">
              {loadingOrders ? <div>Loading orders…</div> :
                orders.length === 0 ? <div>No orders</div> :
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
                          <button onClick={()=>updateOrderStatus(o._id, "accepted")} className="px-2 py-1 bg-blue-600 text-white rounded">Accept</button>
                          <button onClick={()=>updateOrderStatus(o._id, "packed")} className="px-2 py-1 bg-gray-200 rounded">Packed</button>
                          <button onClick={()=>updateOrderStatus(o._id, "out-for-delivery")} className="px-2 py-1 bg-yellow-500 text-white rounded">Out for delivery</button>
                          <button onClick={()=>updateOrderStatus(o._id, "delivered")} className="px-2 py-1 bg-green-600 text-white rounded">Delivered</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>

            {/* Menu */}
            <div>
              <h4 className="font-medium mb-2">Menu for {selectedShop ? selectedShop.name : "—"}</h4>
              {loadingMenu ? <div>Loading menu…</div> :
                menu.length === 0 ? <div>No items</div> :
                <div className="space-y-2">
                  {menu.map(it => (
                    <div key={it._id} className="p-2 border rounded flex justify-between items-center">
                      <div>
                        <div className="font-medium">{it.name}</div>
                        <div className="text-xs text-gray-500">₹{it.price} • id: {it.externalId || it._id}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={()=>disableItem(it._id)} className="px-2 py-1 bg-red-500 text-white rounded">Disable</button>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

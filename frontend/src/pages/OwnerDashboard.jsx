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
  const [newItem, setNewItem] = useState({ name: "", price: "" });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("menu"); // default menu as per mock

  function logout() {
    localStorage.removeItem("merchant_token");
    navigate("/merchant-login");
  }

  function displayOrderLabel(order) {
    if (order.orderNumber || order.orderNumber === 0) {
      return `Order #${String(order.orderNumber).padStart(6, "0")}`;
    }
    return `Order #${String(order._id || "").slice(0, 6)}`;
  }

  async function loadShops() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/me/shops");
      if (!res.ok) throw new Error("Failed to load shops");
      const data = await res.json();
      setShops(data);
      if (data.length && !selectedShop) setSelectedShop(data[0]);
    } catch (e) {
      console.error("Failed to load shops", e);
      alert("Failed to load shops (re-login if needed)");
      const token = localStorage.getItem("merchant_token");
      if (!token) navigate("/merchant-login");
    } finally {
      setLoading(false);
    }
  }

  async function loadMenuForShop(shopId) {
    try {
      if (!shopId) { setMenu([]); return; }
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      setMenu(data);
    } catch (e) {
      console.error("Load menu failed", e);
      alert("Failed to load menu");
    }
  }

  async function loadOrdersForShop(shopId) {
    try {
      if (!shopId) { setOrders([]); return; }
      const res = await apiFetch(`/api/shops/${shopId}/orders`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data);
    } catch (e) {
      console.error("Load orders failed", e);
      alert("Failed to load orders");
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("merchant_token");
    if (!token) { navigate("/merchant-login"); return; }
    loadShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedShop && selectedShop._id) {
      loadMenuForShop(selectedShop._id);
      loadOrdersForShop(selectedShop._id);
    } else {
      setMenu([]); setOrders([]);
    }
  }, [selectedShop]);

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
      await loadMenuForShop(selectedShop._id);
      setActiveTab("menu");
    } catch (e) {
      console.error(e); alert("Network error");
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
      if (!res.ok) { const txt = await res.text(); alert("Toggle failed: " + (txt || res.status)); return; }
      await loadMenuForShop(selectedShop._id);
    } catch (e) { console.error(e); alert("Network error toggling item"); }
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
      if (!res.ok) { const txt = await res.text(); alert("Edit failed: " + (txt || res.status)); return; }
      await loadMenuForShop(selectedShop._id);
    } catch (e) { console.error(e); alert("Network error editing item"); }
  }

  async function deleteItem(item) {
    if (!selectedShop) return;
    if (!confirm("Delete this item?")) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, { method: "DELETE" });
      if (!res.ok) { const txt = await res.text(); alert("Delete failed: " + (txt || res.status)); return; }
      await loadMenuForShop(selectedShop._id);
    } catch (e) { console.error(e); alert("Network error deleting item"); }
  }

  async function updateOrderStatus(orderId, newStatus) {
    setOrders((prev) => prev.map(o => (o._id === orderId ? { ...o, status: newStatus } : o)));
    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) { const txt = await res.text(); throw new Error(txt || "Failed"); }
      const updated = await res.json();
      setOrders((prev) => prev.map(o => (o._id === updated._id ? updated : o)));
    } catch (e) { console.error(e); alert("Failed to update status: " + (e.message || e)); if (selectedShop && selectedShop._id) loadOrdersForShop(selectedShop._id); }
  }

  async function cancelOrder(orderId) {
    if (!confirm("Cancel this order?")) return;
    await updateOrderStatus(orderId, "cancelled");
  }

  async function toggleOnline(shop) {
    try {
      const res = await apiFetch(`/api/shops/${shop._id}/status`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ online: !shop.online }),
      });
      if (!res.ok) throw new Error("Failed to toggle status");
      const updated = await res.json();
      alert(updated.shop.online ? "Shop is now ONLINE" : "Shop is now OFFLINE");
      await loadShops();
    } catch (e) { alert("Toggle error: " + (e.message || e)); }
  }

  async function editShopDetails() {
    if (!selectedShop) return alert("Select a shop first");
    const newName = prompt("Shop name", selectedShop.name);
    const newPhone = prompt("Phone", selectedShop.phone);
    const newAddress = prompt("Address", selectedShop.address || "");
    const newPincode = prompt("Pincode", selectedShop.pincode || "");
    if (!newName || !newPhone || !newAddress || !newPincode) return alert("All fields required");
    try {
      await apiFetch(`/api/shops/${selectedShop._id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, phone: newPhone, address: newAddress, pincode: newPincode }),
      });
      alert("Shop details updated!");
      await loadShops();
    } catch (e) { alert("Failed to update shop: " + (e.message || e)); }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="col-span-3 bg-pink-50 border-2 border-blue-400 rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="font-semibold">☰</div>
            </div>
            <div className="space-y-4">
              <button className="w-full py-2 rounded bg-gray-800 text-white">Your Shop</button>
              <button onClick={() => setActiveTab("menu")} className="w-full py-2 rounded bg-blue-600 text-white">Menu</button>
              <button onClick={() => setActiveTab("orders")} className="w-full py-2 rounded bg-gray-800 text-white">Order</button>
            </div>
          </div>

          <div>
            <button onClick={logout} className="w-full py-2 rounded bg-gray-800 text-white">logout</button>
          </div>
        </aside>

        {/* Main content area */}
        <main className="col-span-9 bg-white rounded p-4 min-h-[70vh] relative">
          {/* Top centered shop info */}
          <div className="text-center mb-4">
            <div className="text-lg font-semibold">{selectedShop ? selectedShop.name : "Shop Name"}</div>
            <div className="text-sm text-gray-500">{selectedShop ? `${selectedShop.address || ""} • ${selectedShop.pincode || ""}` : "Address • Pincode"}</div>
          </div>

          {/* Tabs and add menu button */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-3">
              <button onClick={() => setActiveTab("menu")} className={`px-4 py-2 rounded ${activeTab === "menu" ? "bg-black text-white" : "bg-gray-200"}`}>menu</button>
              <button onClick={() => setActiveTab("orders")} className={`px-4 py-2 rounded ${activeTab === "orders" ? "bg-black text-white" : "bg-gray-200"}`}>order</button>
            </div>
            <div>
              <button onClick={() => {
                if (!selectedShop) return alert("Select a shop");
                setActiveTab("menu");
                // optional: scroll to add item form
              }} className="px-4 py-2 bg-gray-800 text-white rounded">add menu</button>
            </div>
          </div>

          {/* Content area (large grey area in mock) */}
          <div className="bg-gray-200 min-h-[50vh] rounded p-4">
            {activeTab === "menu" ? (
              <div>
                <h3 className="mb-3 font-medium">Menu for {selectedShop ? selectedShop.name : "—"}</h3>
                {selectedShop === null ? <div>Select a shop</div> : menu.length === 0 ? <div>No items</div> : (
                  <div className="space-y-3">
                    {menu.map(item => (
                      <div key={item._id} className="p-3 border rounded bg-white flex justify-between items-center">
                        <div>
                          <div className="font-medium">{item.name} • ₹{item.price}</div>
                          <div className="text-xs text-gray-500">{item.available ? "Available" : "Unavailable"}</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => toggleAvailability(item)} className={`px-3 py-1 rounded text-sm ${item.available ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{item.available ? "Enabled" : "Disabled"}</button>
                          <button onClick={() => editItem(item)} className="px-3 py-1 bg-yellow-400 rounded">Edit</button>
                          <button onClick={() => deleteItem(item)} className="px-3 py-1 bg-gray-300 rounded">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3 className="mb-3 font-medium">Orders for {selectedShop ? selectedShop.name : "—"}</h3>
                {orders.length === 0 ? <div>No orders</div> : (
                  <div className="space-y-3">
                    {orders.map(o => {
                      const status = (o.status || "").toLowerCase();
                      return (
                        <div key={o._id} className="p-3 border rounded bg-white flex justify-between">
                          <div>
                            <div className="font-medium">{displayOrderLabel(o)} — <span className="text-sm text-gray-600">{status}</span></div>
                            <div className="text-sm text-gray-600">{o.items.map(i => `${i.name} x${i.qty}`).join(", ")}</div>
                            <div className="text-sm text-gray-600">₹{o.total}</div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-sm">Customer: <b>{o.customerName}</b></div>
                            <div className="flex gap-2">
                              <button onClick={() => updateOrderStatus(o._id, "accepted")} disabled={status !== "received"} className={`px-3 py-1 rounded ${status === "received" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}>Accept</button>
                              <button onClick={() => updateOrderStatus(o._id, "packed")} disabled={status !== "accepted"} className={`px-3 py-1 rounded ${status === "accepted" ? "bg-yellow-500 text-white" : "bg-gray-200 text-gray-600"}`}>Packed</button>
                              <button onClick={() => updateOrderStatus(o._1d, "out-for-delivery")} disabled={status !== "packed"} className={`px-3 py-1 rounded ${status === "packed" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"}`}>Out for delivery</button>
                              <button onClick={() => updateOrderStatus(o._id, "delivered")} disabled={status !== "out-for-delivery"} className={`px-3 py-1 rounded ${status === "out-for-delivery" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-600"}`}>Delivered</button>
                              <button onClick={() => cancelOrder(o._id)} disabled={status === "delivered" || status === "cancelled"} className={`px-3 py-1 rounded ${status === "cancelled" ? "bg-gray-400 text-white" : "bg-red-500 text-white"}`}>Cancel</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* pagination / footer area like mock */}
          <div className="mt-4 flex justify-end items-center gap-3 text-sm">
            <div className="px-3 py-1 bg-black text-white rounded">1</div>
            <div className="text-gray-600">2</div>
            <div className="text-gray-600">3</div>
            <div className="text-gray-600">...</div>
          </div>
        </main>
      </div>
    </div>
  );
}

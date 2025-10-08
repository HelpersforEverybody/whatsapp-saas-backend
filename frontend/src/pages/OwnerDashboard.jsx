// frontend/src/pages/OwnerDashboard.jsx
import React, { useEffect, useState } from "react";
import { apiFetch, getApiBase } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";

/**
 * OwnerDashboard
 * - Inline shop edit in sidebar when clicking "Your Shop"
 * - Inline Add Item form in main area when "menu" tab active and "add menu" clicked
 * - Add menu disappears when "order" tab selected
 * - No alerts/prompts: inline messages only
 * - Uses default (neutral) Tailwind look
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
  const [activeTab, setActiveTab] = useState("menu"); // default to menu
  const [sidebarMode, setSidebarMode] = useState(null); // 'view'|'edit' - controlled by clicking Your Shop button
  const [shopForm, setShopForm] = useState({ name: "", phone: "", address: "", pincode: "" });
  const [msg, setMsg] = useState(""); // global inline message
  const [shopMsg, setShopMsg] = useState("");
  const [itemMsg, setItemMsg] = useState("");

  // load shops for merchant
  async function loadShops() {
    setLoading(true);
    setMsg("");
    try {
      const res = await apiFetch("/api/me/shops");
      if (!res.ok) throw new Error("Failed to load shops");
      const data = await res.json();
      setShops(data || []);
      if (data && data.length) {
        // preserve selection when possible
        const found = selectedShop ? data.find(s => s._id === selectedShop._id) : data[0];
        setSelectedShop(found || data[0]);
      } else {
        setSelectedShop(null);
      }
    } catch (e) {
      console.error("loadShops", e);
      setMsg("Failed to load shops. Please re-login.");
      const token = localStorage.getItem("merchant_token");
      if (!token) navigate("/merchant-login");
    } finally {
      setLoading(false);
    }
  }

  async function loadMenuForShop(shopId) {
    setMsg("");
    try {
      if (!shopId) { setMenu([]); return; }
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      setMenu(data || []);
    } catch (e) {
      console.error("loadMenuForShop", e);
      setMsg("Failed to load menu");
    }
  }

  async function loadOrdersForShop(shopId) {
    setMsg("");
    try {
      if (!shopId) { setOrders([]); return; }
      const res = await apiFetch(`/api/shops/${shopId}/orders`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data || []);
    } catch (e) {
      console.error("loadOrdersForShop", e);
      setMsg("Failed to load orders");
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
      // populate shop form for inline edit
      setShopForm({
        name: selectedShop.name || "",
        phone: selectedShop.phone || "",
        address: selectedShop.address || "",
        pincode: selectedShop.pincode || "",
      });
      loadMenuForShop(selectedShop._id);
      loadOrdersForShop(selectedShop._id);
    } else {
      setMenu([]); setOrders([]);
      setShopForm({ name: "", phone: "", address: "", pincode: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShop]);

  function logout() {
    localStorage.removeItem("merchant_token");
    navigate("/merchant-login");
  }

  // inline shop edit handlers
  function openShopEdit() {
    setSidebarMode("edit");
    setShopMsg("");
  }
  function closeShopEdit() {
    setSidebarMode("view");
    setShopMsg("");
    // revert form to selectedShop
    if (selectedShop) {
      setShopForm({
        name: selectedShop.name || "",
        phone: selectedShop.phone || "",
        address: selectedShop.address || "",
        pincode: selectedShop.pincode || "",
      });
    }
  }

  async function saveShopDetails(e) {
    e.preventDefault();
    setShopMsg("");
    if (!selectedShop) { setShopMsg("No shop selected"); return; }
    const { name, phone, address, pincode } = shopForm;
    if (!name || !phone || !address || !pincode) { setShopMsg("All fields are required"); return; }
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address, pincode }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to save shop");
      }
      setShopMsg("Saved");
      await loadShops();
      setSidebarMode("view");
    } catch (err) {
      console.error("saveShopDetails", err);
      setShopMsg("Error: " + (err.message || err));
    }
  }

  // Add item inline (only visible when menu tab is active)
  async function addItem(e) {
    e.preventDefault();
    setItemMsg("");
    if (!selectedShop) { setItemMsg("Select a shop first"); return; }
    if (!newItem.name) { setItemMsg("Item name required"); return; }
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newItem.name, price: Number(newItem.price || 0) }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to add item");
      }
      setItemMsg("Item added");
      setNewItem({ name: "", price: "" });
      await loadMenuForShop(selectedShop._id);
      setActiveTab("menu");
    } catch (err) {
      console.error("addItem", err);
      setItemMsg("Error: " + (err.message || err));
    }
  }

  // toggle menu item availability
  async function toggleAvailability(item) {
    setItemMsg("");
    if (!selectedShop) { setItemMsg("Select a shop"); return; }
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Toggle failed");
      }
      await loadMenuForShop(selectedShop._id);
    } catch (err) {
      console.error("toggleAvailability", err);
      setItemMsg("Error toggling item: " + (err.message || err));
    }
  }

  async function editItem(item) {
    setItemMsg("");
    // show simple inline edit (reuse newItem area temporarily)
    setNewItem({ name: item.name, price: String(item.price || 0), _editingId: item._id });
  }

  async function saveEditedItem(e) {
    e.preventDefault();
    setItemMsg("");
    if (!selectedShop) { setItemMsg("Select shop first"); return; }
    const id = newItem._editingId;
    if (!id) { setItemMsg("No item selected to edit"); return; }
    if (!newItem.name) { setItemMsg("Item name required"); return; }
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newItem.name, price: Number(newItem.price || 0) }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Edit failed");
      }
      setItemMsg("Item updated");
      setNewItem({ name: "", price: "" });
      await loadMenuForShop(selectedShop._id);
    } catch (err) {
      console.error("saveEditedItem", err);
      setItemMsg("Error: " + (err.message || err));
    }
  }

  async function deleteItem(item) {
    setItemMsg("");
    if (!selectedShop) { setItemMsg("Select shop first"); return; }
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Delete failed");
      }
      setItemMsg("Deleted");
      await loadMenuForShop(selectedShop._id);
    } catch (err) {
      console.error("deleteItem", err);
      setItemMsg("Error deleting item: " + (err.message || err));
    }
  }

  // orders
  async function updateOrderStatus(orderId, newStatus) {
    setMsg("");
    setOrders(prev => prev.map(o => (o._id === orderId ? { ...o, status: newStatus } : o)));
    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to update status");
      }
      const updated = await res.json();
      setOrders(prev => prev.map(o => (o._id === updated._id ? updated : o)));
      setMsg("Order updated");
    } catch (err) {
      console.error("updateOrderStatus", err);
      setMsg("Failed to update order: " + (err.message || err));
      if (selectedShop && selectedShop._id) loadOrdersForShop(selectedShop._id);
    }
  }

  async function cancelOrder(orderId) {
    await updateOrderStatus(orderId, "cancelled");
  }

  function displayOrderLabel(order) {
    if (order.orderNumber || order.orderNumber === 0) return `Order #${String(order.orderNumber).padStart(6, "0")}`;
    return `Order #${String(order._id || "").slice(0, 6)}`;
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto bg-white p-4 rounded shadow grid grid-cols-12 gap-6">
        {/* Sidebar (col 1-3) */}
        <aside className="col-span-3 border rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-xl font-semibold">☰</div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => { setSidebarMode(sidebarMode === "edit" ? "view" : "edit"); setShopMsg(""); }}
                className="w-full py-2 rounded bg-gray-800 text-white"
              >
                Your Shop
              </button>

              <button
                onClick={() => { setActiveTab("menu"); setSidebarMode("view"); }}
                className={`w-full py-2 rounded ${activeTab === "menu" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                Menu
              </button>

              <button
                onClick={() => { setActiveTab("orders"); setSidebarMode("view"); }}
                className={`w-full py-2 rounded ${activeTab === "orders" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                Order
              </button>
            </div>
          </div>

          <div>
            <button onClick={logout} className="w-full py-2 rounded bg-gray-800 text-white">logout</button>
          </div>
        </aside>

        {/* Main area (col 4-12) */}
        <main className="col-span-9">
          {/* top-centered shop info */}
          <div className="text-center mb-4">
            <div className="text-lg font-semibold">{selectedShop ? selectedShop.name : "Shop Name"}</div>
            <div className="text-sm text-gray-500">{selectedShop ? `${selectedShop.address || ""} • ${selectedShop.pincode || ""}` : "Address • Pincode"}</div>
          </div>

          {/* messages */}
          {msg && <div className="mb-3 text-sm text-red-600">{msg}</div>}

          {/* Tabs + Add menu button */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-3">
              <button onClick={() => setActiveTab("menu")} className={`px-4 py-2 rounded ${activeTab === "menu" ? "bg-black text-white" : "bg-gray-200"}`}>menu</button>
              <button onClick={() => setActiveTab("orders")} className={`px-4 py-2 rounded ${activeTab === "orders" ? "bg-black text-white" : "bg-gray-200"}`}>order</button>
            </div>

            <div>
              {/* show add menu only when menu tab is active */}
              {activeTab === "menu" && (
                <button onClick={() => { setItemMsg(""); setNewItem({ name: "", price: "" }); }} className="px-4 py-2 bg-gray-800 text-white rounded">add menu</button>
              )}
            </div>
          </div>

          {/* layout: main content area */}
          <div className="bg-gray-100 rounded p-4 min-h-[40vh]">
            {/* MENU tab UI */}
            {activeTab === "menu" && (
              <>
                <h3 className="mb-3 font-medium">Menu for {selectedShop ? selectedShop.name : "—"}</h3>

                {/* Inline Add/Edit item form (top-right in your mock) */}
                <div className="mb-4 flex justify-end">
                  <form onSubmit={newItem._editingId ? saveEditedItem : addItem} className="flex items-center gap-2">
                    <input value={newItem.name} onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))} placeholder="Item name" className="p-2 border rounded" />
                    <input value={newItem.price} onChange={(e) => setNewItem(prev => ({ ...prev, price: e.target.value }))} placeholder="Price" type="number" className="p-2 border rounded w-28" />
                    <button type="submit" className="px-3 py-2 bg-green-600 text-white rounded">{newItem._editingId ? "Save" : "Add"}</button>
                    <button type="button" onClick={() => setNewItem({ name: "", price: "" })} className="px-3 py-2 bg-gray-300 rounded">Clear</button>
                  </form>
                </div>

                {itemMsg && <div className="mb-3 text-sm text-gray-700">{itemMsg}</div>}

                {/* Menu list */}
                {selectedShop === null ? <div>Select a shop to view its menu</div> : menu.length === 0 ? <div>No items</div> : (
                  <div className="space-y-3">
                    {menu.map(it => (
                      <div key={it._id} className="p-3 bg-white rounded border flex justify-between items-center">
                        <div>
                          <div className="font-medium">{it.name} • ₹{it.price}</div>
                          <div className="text-xs text-gray-500">{it.available ? "Available" : "Unavailable"}</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => toggleAvailability(it)} className={`px-3 py-1 rounded text-sm ${it.available ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{it.available ? "Enabled" : "Disabled"}</button>
                          <button onClick={() => editItem(it)} className="px-3 py-1 bg-yellow-400 rounded">Edit</button>
                          <button onClick={() => deleteItem(it)} className="px-3 py-1 bg-gray-300 rounded">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ORDERS tab UI */}
            {activeTab === "orders" && (
              <>
                <h3 className="mb-3 font-medium">Orders for {selectedShop ? selectedShop.name : "—"}</h3>
                {orders.length === 0 ? <div>No orders</div> : (
                  <div className="space-y-3">
                    {orders.map(o => {
                      const status = (o.status || "").toLowerCase();
                      return (
                        <div key={o._id} className="p-3 bg-white rounded border flex justify-between">
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
                              <button onClick={() => updateOrderStatus(o._id, "out-for-delivery")} disabled={status !== "packed"} className={`px-3 py-1 rounded ${status === "packed" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"}`}>Out for delivery</button>
                              <button onClick={() => updateOrderStatus(o._id, "delivered")} disabled={status !== "out-for-delivery"} className={`px-3 py-1 rounded ${status === "out-for-delivery" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-600"}`}>Delivered</button>
                              <button onClick={() => cancelOrder(o._id)} disabled={status === "delivered" || status === "cancelled"} className={`px-3 py-1 rounded ${status === "cancelled" ? "bg-gray-400 text-white" : "bg-red-500 text-white"}`}>Cancel</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* Inline sidebar edit panel (rendered within the same grid, below sidebar when in edit mode) */}
        <div className="col-span-3 mt-4">
          {sidebarMode === "edit" && selectedShop && (
            <div className="p-4 border rounded bg-white">
              <h4 className="font-medium mb-2">Edit Shop</h4>
              <form onSubmit={saveShopDetails} className="space-y-2">
                <div>
                  <label className="text-sm block mb-1">Name</label>
                  <input className="w-full p-2 border rounded" value={shopForm.name} onChange={e => setShopForm(s => ({ ...s, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm block mb-1">Phone</label>
                  <input className="w-full p-2 border rounded" value={shopForm.phone} onChange={e => setShopForm(s => ({ ...s, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm block mb-1">Address</label>
                  <input className="w-full p-2 border rounded" value={shopForm.address} onChange={e => setShopForm(s => ({ ...s, address: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm block mb-1">Pincode</label>
                  <input className="w-full p-2 border rounded" value={shopForm.pincode} onChange={e => setShopForm(s => ({ ...s, pincode: e.target.value }))} />
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>
                  <button type="button" onClick={closeShopEdit} className="px-3 py-2 bg-gray-200 rounded">Cancel</button>
                </div>

                {shopMsg && <div className="text-sm mt-1 text-gray-700">{shopMsg}</div>}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

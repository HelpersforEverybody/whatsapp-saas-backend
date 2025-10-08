// frontend/src/pages/OwnerDashboard.jsx
import React, { useEffect, useState } from "react";
import { apiFetch, getApiBase } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";

/**
 * OwnerDashboard — view-mode layout:
 * - Sidebar (Your Shop / Menu / Order) left
 * - Main area right: shows ONLY the active view
 *   - your-shop -> inline shop edit panel in the main area (tabs hidden)
 *   - menu -> inline add/edit form (top-right) + menu list
 *   - order -> orders list (add/edit form hidden)
 *
 * All interactions are inline (no prompt/alert).
 */

export default function OwnerDashboard() {
  const API_BASE = getApiBase();
  const navigate = useNavigate();

  // data
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);

  // UI / form state
  const [activeView, setActiveView] = useState("menu"); // "your-shop" | "menu" | "order"
  const [loading, setLoading] = useState(false);

  // shop edit form (used in "your-shop" view)
  const [shopForm, setShopForm] = useState({ name: "", phone: "", address: "", pincode: "" });
  const [shopMsg, setShopMsg] = useState("");

  // add/edit item form (only visible in "menu" view)
  const [itemForm, setItemForm] = useState({ name: "", price: "", _editingId: null });
  const [itemMsg, setItemMsg] = useState("");
  const [deletingItemId, setDeletingItemId] = useState(null); // inline confirm for delete

  // order messages
  const [orderMsg, setOrderMsg] = useState("");

  // generic top message
  const [msg, setMsg] = useState("");

  // load merchant shops
  async function loadShops() {
    setLoading(true);
    setMsg("");
    try {
      const res = await apiFetch("/api/me/shops");
      if (!res.ok) throw new Error("Failed to load shops");
      const data = await res.json();
      setShops(data || []);
      if (data && data.length) {
        // keep previous selection when possible
        const found = selectedShop ? data.find(s => s._id === selectedShop._id) : data[0];
        setSelectedShop(found || data[0]);
      } else {
        setSelectedShop(null);
      }
    } catch (err) {
      console.error("loadShops", err);
      setMsg("Failed to load shops. Re-login if needed.");
      const token = localStorage.getItem("merchant_token");
      if (!token) navigate("/merchant-login");
    } finally {
      setLoading(false);
    }
  }

  async function loadMenuForShop(shopId) {
    setItemMsg("");
    try {
      if (!shopId) { setMenu([]); return; }
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      setMenu(data || []);
    } catch (err) {
      console.error("loadMenuForShop", err);
      setMsg("Failed to load menu");
    }
  }

  async function loadOrdersForShop(shopId) {
    setOrderMsg("");
    try {
      if (!shopId) { setOrders([]); return; }
      const res = await apiFetch(`/api/shops/${shopId}/orders`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data || []);
    } catch (err) {
      console.error("loadOrdersForShop", err);
      setMsg("Failed to load orders");
    }
  }

  // initial
  useEffect(() => {
    const token = localStorage.getItem("merchant_token");
    if (!token) { navigate("/merchant-login"); return; }
    loadShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when selected shop changes populate shopForm and reload content
  useEffect(() => {
    if (selectedShop) {
      setShopForm({
        name: selectedShop.name || "",
        phone: selectedShop.phone || "",
        address: selectedShop.address || "",
        pincode: selectedShop.pincode || "",
      });
      loadMenuForShop(selectedShop._id);
      loadOrdersForShop(selectedShop._id);
    } else {
      setShopForm({ name: "", phone: "", address: "", pincode: "" });
      setMenu([]);
      setOrders([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShop]);

  function logout() {
    localStorage.removeItem("merchant_token");
    navigate("/merchant-login");
  }

  // ---- Shop edit (your-shop) ----
  async function saveShop(e) {
    e && e.preventDefault();
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
        throw new Error(txt || "Save failed");
      }
      setShopMsg("Saved");
      await loadShops();
    } catch (err) {
      console.error("saveShop", err);
      setShopMsg("Error: " + (err.message || err));
    }
  }

  // ---- Menu: add / edit ----
  async function submitItem(e) {
    e && e.preventDefault();
    setItemMsg("");
    if (!selectedShop) { setItemMsg("Select a shop first"); return; }
    if (!itemForm.name) { setItemMsg("Item name required"); return; }
    try {
      if (itemForm._editingId) {
        // edit existing
        const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${itemForm._editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: itemForm.name, price: Number(itemForm.price || 0) }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Edit failed");
        }
        setItemMsg("Item updated");
        setItemForm({ name: "", price: "", _editingId: null });
      } else {
        // create
        const res = await apiFetch(`/api/shops/${selectedShop._id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: itemForm.name, price: Number(itemForm.price || 0) }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Add failed");
        }
        setItemMsg("Item added");
        setItemForm({ name: "", price: "", _editingId: null });
      }
      await loadMenuForShop(selectedShop._id);
    } catch (err) {
      console.error("submitItem", err);
      setItemMsg("Error: " + (err.message || err));
    }
  }

  function startEditItem(item) {
    setItemMsg("");
    setItemForm({ name: item.name, price: String(item.price || ""), _editingId: item._id });
  }

  async function confirmDeleteItem(itemId) {
    setItemMsg("");
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Delete failed");
      }
      setItemMsg("Deleted");
      setDeletingItemId(null);
      await loadMenuForShop(selectedShop._id);
    } catch (err) {
      console.error("confirmDeleteItem", err);
      setItemMsg("Error deleting: " + (err.message || err));
    }
  }

  async function toggleAvailability(item) {
    setItemMsg("");
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
      setItemMsg("Error: " + (err.message || err));
    }
  }

  // ---- Orders ----
  async function updateOrderStatus(orderId, newStatus) {
    setOrderMsg("");
    // optimistic UI
    setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: newStatus } : o));
    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Update failed");
      }
      const updated = await res.json();
      setOrders(prev => prev.map(o => (o._id === updated._id ? updated : o)));
      setOrderMsg("Order updated");
    } catch (err) {
      console.error("updateOrderStatus", err);
      setOrderMsg("Error: " + (err.message || err));
      if (selectedShop && selectedShop._id) loadOrdersForShop(selectedShop._id);
    }
  }

  function displayOrderLabel(order) {
    if (order.orderNumber || order.orderNumber === 0) return `Order #${String(order.orderNumber).padStart(6, "0")}`;
    return `Order #${String(order._id || "").slice(0, 6)}`;
  }

  // UI helpers
  function selectShopAndView(shop, view = "menu") {
    setSelectedShop(shop);
    setActiveView(view);
    setMsg("");
    setItemMsg("");
    setShopMsg("");
    setOrderMsg("");
  }

  // render
  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto bg-white p-4 rounded shadow grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="col-span-3 border rounded p-4 flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <button className="text-xl">☰</button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => { setActiveView("your-shop"); setShopMsg(""); setItemMsg(""); setOrderMsg(""); }}
                aria-pressed={activeView === "your-shop"}
                className={`w-full py-2 rounded ${activeView === "your-shop" ? "bg-gray-900 text-white" : "bg-gray-200"}`}
              >
                Your Shop
              </button>

              <button
                onClick={() => { setActiveView("menu"); setItemMsg(""); setShopMsg(""); }}
                aria-pressed={activeView === "menu"}
                className={`w-full py-2 rounded ${activeView === "menu" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                Menu
              </button>

              <button
                onClick={() => { setActiveView("order"); setOrderMsg(""); setShopMsg(""); }}
                aria-pressed={activeView === "order"}
                className={`w-full py-2 rounded ${activeView === "order" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                Order
              </button>
            </div>
          </div>

          <div>
            <button onClick={logout} className="w-full py-2 rounded bg-gray-900 text-white">logout</button>
          </div>
        </aside>

        {/* Main area */}
        <main className="col-span-9">
          {/* header: centered shop name & pincode */}
        {/* header: centered shop name & pincode */}
<div className="flex flex-col items-center justify-center mb-4 relative">
  {selectedShop && (
    <div className="absolute right-0 top-0 flex items-center gap-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!selectedShop.online}
          onChange={async (e) => {
            const newVal = e.target.checked;
            setShopMsg("Updating...");
            // Optimistic UI
            setSelectedShop(prev => prev ? ({ ...prev, online: newVal }) : prev);
            try {
              const res = await apiFetch(`/api/shops/${selectedShop._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ online: newVal }),
              });
              if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || "Failed to update");
              }
              await res.json();
              setShopMsg(newVal ? "Shop is now Online" : "Shop is now Offline");
              await loadShops();
            } catch (err) {
              console.error("toggle online error", err);
              setShopMsg("Failed to change status");
              setSelectedShop(prev => prev ? ({ ...prev, online: !newVal }) : prev);
            }
          }}
          className="toggle-checkbox"
        />
        <span
          className={`px-2 py-1 rounded text-xs ${
            selectedShop.online
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {selectedShop.online ? "Online" : "Offline"}
        </span>
      </label>
    </div>
  )}

  <div className="text-lg font-semibold">
    {selectedShop ? selectedShop.name : "Shop Name"}
  </div>

  <div className="text-sm text-gray-500">
    {selectedShop
      ? `${selectedShop.address || ""}${
          selectedShop.pincode ? " • " + selectedShop.pincode : ""
        }`
      : "Address • Pincode"}
  </div>
</div>


          {/* top inline messages */}
          {(msg || shopMsg || itemMsg || orderMsg) && (
            <div className="mb-3 space-y-1">
              {msg && <div className="text-sm text-red-600">{msg}</div>}
              {shopMsg && <div className="text-sm text-gray-700">{shopMsg}</div>}
              {itemMsg && <div className="text-sm text-gray-700">{itemMsg}</div>}
              {orderMsg && <div className="text-sm text-gray-700">{orderMsg}</div>}
            </div>
          )}

          {/* Tab buttons — hidden when your-shop is active */}
          {activeView !== "your-shop" && (
            <div className="flex items-center justify-start gap-3 mb-4">
              <button onClick={() => setActiveView("menu")} className={`px-3 py-1 rounded ${activeView === "menu" ? "bg-black text-white" : "bg-gray-200"}`}>menu</button>
              <button onClick={() => setActiveView("order")} className={`px-3 py-1 rounded ${activeView === "order" ? "bg-black text-white" : "bg-gray-200"}`}>order</button>
            </div>
          )}

          {/* Content area box */}
          <div className="bg-gray-100 rounded p-4 min-h-[40vh]">
            {/* YOUR SHOP view: show only the shop edit panel inside main area */}
            {activeView === "your-shop" && (
              <div className="max-w-md mx-auto bg-white p-4 rounded shadow-sm">
                <h3 className="font-medium mb-2">Edit Shop</h3>
                <form onSubmit={saveShop} className="space-y-3">
                  <div>
                    <label className="text-sm block mb-1">Name</label>
                    <input value={shopForm.name} onChange={e => setShopForm(s => ({ ...s, name: e.target.value }))} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="text-sm block mb-1">Phone</label>
                    <input value={shopForm.phone} onChange={e => setShopForm(s => ({ ...s, phone: e.target.value }))} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="text-sm block mb-1">Address</label>
                    <input value={shopForm.address} onChange={e => setShopForm(s => ({ ...s, address: e.target.value }))} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="text-sm block mb-1">Pincode</label>
                    <input value={shopForm.pincode} onChange={e => setShopForm(s => ({ ...s, pincode: e.target.value }))} className="w-full p-2 border rounded" />
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>
                    <button type="button" onClick={() => {
                      // revert form
                      setShopForm({
                        name: selectedShop?.name || "",
                        phone: selectedShop?.phone || "",
                        address: selectedShop?.address || "",
                        pincode: selectedShop?.pincode || "",
                      });
                      setShopMsg("");
                    }} className="px-3 py-2 bg-gray-200 rounded">Cancel</button>
                  </div>
                  {shopMsg && <div className="text-sm text-gray-700 mt-1">{shopMsg}</div>}
                </form>
              </div>
            )}

            {/* MENU view */}
            {activeView === "menu" && (
              <>
                {/* inline add/edit form at top-right (we center container and right-align the form) */}
                <div className="flex justify-end mb-4">
                  <form onSubmit={submitItem} className="flex items-center gap-2">
                    <input value={itemForm.name} onChange={e => setItemForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Item name" className="p-2 border rounded" />
                    <input value={itemForm.price} onChange={e => setItemForm(prev => ({ ...prev, price: e.target.value }))} placeholder="Price" type="number" className="p-2 border rounded w-28" />
                    <button type="submit" className="px-3 py-2 bg-green-600 text-white rounded">{itemForm._editingId ? "Save" : "Add"}</button>
                    <button type="button" onClick={() => setItemForm({ name: "", price: "", _editingId: null })} className="px-3 py-2 bg-gray-200 rounded">Clear</button>
                  </form>
                </div>

                {/* menu list */}
                <h4 className="mb-2 font-medium">Menu for {selectedShop ? selectedShop.name : "—"}</h4>
                {selectedShop === null ? (
                  <div>Select a shop to view its menu</div>
                ) : menu.length === 0 ? (
                  <div>No items</div>
                ) : (
                  <div className="space-y-3">
                    {menu.map(it => (
                      <div key={it._id} className="bg-white border rounded p-3 flex justify-between items-center">
                        <div>
                          <div className="font-medium">{it.name} • ₹{it.price}</div>
                          <div className="text-xs text-gray-500">{it.available ? "Available" : "Unavailable"}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleAvailability(it)} className={`px-3 py-1 rounded text-sm ${it.available ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                            {it.available ? "Enabled" : "Disabled"}
                          </button>

                          <button onClick={() => startEditItem(it)} className="px-3 py-1 bg-yellow-400 rounded">Edit</button>

                          {deletingItemId === it._id ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => confirmDeleteItem(it._id)} className="px-3 py-1 bg-red-600 text-white rounded">Yes</button>
                              <button onClick={() => setDeletingItemId(null)} className="px-3 py-1 bg-gray-200 rounded">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeletingItemId(it._id)} className="px-3 py-1 bg-gray-300 rounded">Delete</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ORDERS view */}
            {activeView === "order" && (
              <>
                <h4 className="mb-2 font-medium">Orders for {selectedShop ? selectedShop.name : "—"}</h4>
                {selectedShop === null ? (
                  <div>Select a shop to view orders</div>
                ) : orders.length === 0 ? (
                  <div>No orders</div>
                ) : (
                  <div className="space-y-3">
                    {orders.map(o => {
                      const status = (o.status || "").toLowerCase();
                      return (
                        <div key={o._id} className="bg-white border rounded p-3 flex justify-between">
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
                              <button onClick={() => updateOrderStatus(o._id, "cancelled")} disabled={status === "delivered" || status === "cancelled"} className={`px-3 py-1 rounded ${status === "cancelled" ? "bg-gray-400 text-white" : "bg-red-500 text-white"}`}>Cancel</button>
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
      </div>
    </div>
  );
}

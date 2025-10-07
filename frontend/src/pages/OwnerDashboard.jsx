// frontend/src/pages/OwnerDashboard.jsx
import React, { useEffect, useState } from "react";
import { apiFetch, getApiBase } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";

/**
 * Owner Dashboard (drop-in)
 * - Same logic as before
 * - If merchant has no shops, a small Create Shop form appears (owner can create one shop)
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

  // create shop form state (shown when no shops / or user wants to add)
  const [createShopForm, setCreateShopForm] = useState({ name: "", phone: "", description: "", pincode: "" });
  const [creatingShop, setCreatingShop] = useState(false);

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
      if (!res.ok) {
        throw new Error("Failed to load shops");
      }
      const data = await res.json();
      setShops(data);
      if (data.length && (!selectedShop || !selectedShop._id)) setSelectedShop(data[0]);
    } catch (e) {
      console.error("Failed to load shops", e);
      alert("Failed to load shops (re-login if needed)");
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
      const res = await apiFetch(`/api/shops/${shopId}/orders`);
      if (!res.ok) throw new Error("Failed to load orders");
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
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      setMenu(data);
    } catch (e) {
      console.error("Load menu failed", e);
      alert("Failed to load menu");
    }
  }

  async function updateOrderStatus(orderId, newStatus) {
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
    } catch (e) {
      console.error("Update status error", e);
      alert("Failed to update status: " + (e.message || e));
      if (selectedShop && selectedShop._id) loadOrdersForShop(selectedShop._id);
    }
  }

  async function cancelOrder(orderId) {
    if (!confirm("Cancel this order?")) return;
    await updateOrderStatus(orderId, "cancelled");
  }

  // item actions (owner)
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
    } catch (e) {
      console.error(e);
      alert("Network error");
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

  // New: create shop from dashboard (merchant already logged in)
  async function createShopFromDashboard(e) {
    e.preventDefault();
    if (!createShopForm.name || !createShopForm.phone) return alert("Shop name and phone required");
    setCreatingShop(true);
    try {
      const token = localStorage.getItem("merchant_token");
      if (!token) {
        alert("Session missing — login again");
        navigate("/merchant-login");
        return;
      }
      const res = await fetch(`${API_BASE}/api/shops`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createShopForm),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to create shop");
      }
      const shop = await res.json();
      alert("Shop created");
      setCreateShopForm({ name: "", phone: "", description: "", pincode: "" });
      await loadShops();
    } catch (err) {
      console.error("Create shop failed", err);
      alert("Create shop failed: " + (err.message || err));
    } finally {
      setCreatingShop(false);
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

            {/* Show create-shop form when merchant has no shops */}
            {shops.length === 0 && (
              <div className="mt-6 border-t pt-3">
                <h4 className="font-medium">Create your shop</h4>
                <form onSubmit={createShopFromDashboard}>
                  <input name="name" value={createShopForm.name} onChange={e=>setCreateShopForm({...createShopForm, name:e.target.value})} placeholder="Shop name" className="w-full p-2 border rounded my-2"/>
                  <input name="phone" value={createShopForm.phone} onChange={e=>setCreateShopForm({...createShopForm, phone:e.target.value})} placeholder="Shop phone (10 digits or +91...)" className="w-full p-2 border rounded my-2"/>
                  <input name="pincode" value={createShopForm.pincode} onChange={e=>setCreateShopForm({...createShopForm, pincode:e.target.value})} placeholder="Pincode (optional)" className="w-full p-2 border rounded my-2"/>
                  <input name="description" value={createShopForm.description} onChange={e=>setCreateShopForm({...createShopForm, description:e.target.value})} placeholder="Short description (optional)" className="w-full p-2 border rounded my-2"/>
                  <div className="flex gap-2">
                    <button disabled={creatingShop} type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">{creatingShop ? "Creating..." : "Create shop"}</button>
                    <button type="button" onClick={()=>navigate("/shops-and-menu")} className="px-3 py-2 bg-gray-200 rounded">Go to Shops page</button>
                  </div>
                </form>
              </div>
            )}

          </div>

          <div className="col-span-2">
            <h3 className="font-medium mb-2">Orders for {selectedShop ? selectedShop.name : "—"}</h3>
            {orders.length === 0 ? <div>No orders</div> :
              <div className="space-y-3">
                {orders.map(o => {
                  const status = (o.status || "").toLowerCase();
                  return (
                    <div key={o._id} className="p-3 border rounded bg-white flex justify-between">
                      <div>
                        <div className="font-medium">{displayOrderLabel(o)} — <span className="text-sm text-gray-600">{status}</span></div>
                        <div className="text-sm text-gray-600">{o.items.map(i=>`${i.name} x${i.qty}`).join(", ")}</div>
                        <div className="text-sm text-gray-600">₹{o.total}</div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="text-sm">Customer: <b>{o.customerName}</b></div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateOrderStatus(o._id, "accepted")}
                            disabled={status !== "received"}
                            className={`px-3 py-1 rounded ${status === "received" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}
                          >
                            Accept
                          </button>

                          <button
                            onClick={() => updateOrderStatus(o._id, "packed")}
                            disabled={status !== "accepted"}
                            className={`px-3 py-1 rounded ${status === "accepted" ? "bg-yellow-500 text-white" : "bg-gray-200 text-gray-600"}`}
                          >
                            Packed
                          </button>

                          <button
                            onClick={() => updateOrderStatus(o._id, "out-for-delivery")}
                            disabled={status !== "packed"}
                            className={`px-3 py-1 rounded ${status === "packed" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"}`}
                          >
                            Out for delivery
                          </button>

                          <button
                            onClick={() => updateOrderStatus(o._id, "delivered")}
                            disabled={status !== "out-for-delivery"}
                            className={`px-3 py-1 rounded ${status === "out-for-delivery" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-600"}`}
                          >
                            Delivered
                          </button>

                          <button
                            onClick={() => cancelOrder(o._id)}
                            disabled={status === "delivered" || status === "cancelled"}
                            className={`px-3 py-1 rounded ${status === "cancelled" ? "bg-gray-400 text-white" : "bg-red-500 text-white"}`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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

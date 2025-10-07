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

  function logout() {
    localStorage.removeItem("merchant_token");
    navigate("/merchant-login");
  }

  // load shops for current merchant
  async function loadMyShops() {
    setLoading(true);
    try {
      // Prefer owner-specific endpoint if backend provides it.
      // If your backend doesn't have /api/me/shops, fallback to /api/shops
      let res = await apiFetch("/api/me/shops");
      if (!res.ok) {
        // fallback to public shops then filter by owner client-side (older approach)
        res = await apiFetch("/api/shops");
        if (!res.ok) throw new Error("Failed to load shops");
        const all = await res.json();
        setShops(all);
        if (all.length) setSelectedShop(all[0]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setShops(data);
      if (data.length) setSelectedShop(data[0]);
    } catch (e) {
      console.error("Load shops error", e);
      alert("Failed to load your shops (re-login if needed)");
    } finally {
      setLoading(false);
    }
  }

  // load orders for a shop (owner-only endpoint)
  async function loadOrdersForShop(shopId) {
    try {
      const res = await apiFetch(`/api/shops/${shopId}/orders`);
      if (!res.ok) {
        console.warn("Load orders for shop failed", res.status);
        setOrders([]);
        return;
      }
      const data = await res.json();
      setOrders(data);
    } catch (e) {
      console.error("Load orders error", e);
      setOrders([]);
    }
  }

  // load menu for a shop (public)
  async function loadMenuForShop(shopId) {
    try {
      const res = await apiFetch(`/api/shops/${shopId}/menu`);
      if (!res.ok) {
        setMenu([]);
        return;
      }
      const data = await res.json();
      setMenu(data);
    } catch (e) {
      console.error("Load menu error", e);
      setMenu([]);
    }
  }

  // add menu item (owner)
  async function addItem() {
    if (!selectedShop) return alert("Select a shop first");
    if (!newItem.name || newItem.name.trim() === "") return alert("Item name required");
    const payload = { name: newItem.name.trim(), price: Number(newItem.price || 0) };
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert("Add item failed: " + (txt || res.status));
        return;
      }
      alert("Item added");
      setNewItem({ name: "", price: "" });
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error(e);
      alert("Network error while adding item");
    }
  }

  // delete menu item
  async function deleteItem(itemId) {
    if (!selectedShop) return;
    if (!confirm("Delete this item?")) return;
    try {
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${itemId}`, {
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
      alert("Network error while deleting item");
    }
  }

  // enable / disable toggle
  async function toggleAvailable(item) {
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
      alert("Network error while toggling availability");
    }
  }

  // EDIT: prompt for new name/price and PATCH
  async function editItem(item) {
    if (!selectedShop) return;
    try {
      const newName = prompt("Edit item name:", item.name);
      if (newName === null) return; // user cancelled
      let newPriceStr = prompt("Edit item price (number):", String(item.price || 0));
      if (newPriceStr === null) return;

      const newPrice = Number(newPriceStr);
      if (Number.isNaN(newPrice)) {
        alert("Invalid price");
        return;
      }

      const payload = { name: newName.trim(), price: newPrice };
      const res = await apiFetch(`/api/shops/${selectedShop._id}/items/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert("Edit failed: " + (txt || res.status));
        return;
      }
      alert("Item updated");
      await loadMenuForShop(selectedShop._id);
    } catch (e) {
      console.error(e);
      alert("Network error while editing item");
    }
  }

  // update order status from owner dashboard (convenience)
  async function updateOrderStatus(oId, status) {
    try {
      const res = await apiFetch(`/api/orders/${oId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert("Failed to update order: " + (txt || res.status));
        return;
      }
      await loadOrdersForShop(selectedShop._id);
    } catch (e) {
      console.error(e);
      alert("Network error while updating order");
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("merchant_token");
    if (!token) {
      navigate("/merchant-login");
      return;
    }
    loadMyShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when shop changes load orders & menu
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
            {loading ? <div>Loading...</div> :
              shops.length === 0 ? <div>No shops</div> :
              shops.map(s => (
                <div
                  key={s._id}
                  className={`p-2 mb-2 border rounded cursor-pointer ${selectedShop && selectedShop._id === s._id ? "bg-blue-50" : ""}`}
                  onClick={() => setSelectedShop(s)}
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.phone}</div>
                </div>
              ))
            }

            <div className="mt-4 border-t pt-3">
              <h4 className="font-medium">Add Item to Selected Shop</h4>
              <input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} placeholder="Item name" className="w-full p-2 border rounded my-2" />
              <input value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} placeholder="Price" type="number" className="w-full p-2 border rounded my-2" />
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
                      <div className="text-sm text-gray-600">{o.items.map(i => `${i.name} x${i.qty}`).join(", ")}</div>
                      <div className="text-sm text-gray-600">Total: ₹{o.total}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-sm">Status: <b>{o.status}</b></div>
                      <div className="flex gap-2">
                        <button onClick={() => updateOrderStatus(o._id, "accepted")} className="px-2 py-1 bg-blue-600 text-white rounded">Accept</button>
                        <button onClick={() => updateOrderStatus(o._id, "packed")} className="px-2 py-1 bg-gray-200 rounded">Packed</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            }

            <div className="mt-6">
              <h3 className="font-medium mb-2">Menu for {selectedShop ? selectedShop.name : "—"}</h3>
              {menu.length === 0 ? <div>No items</div> :
                <div className="space-y-3">
                  {menu.map(it => (
                    <div key={it._id} className="p-3 border rounded bg-white flex justify-between items-center">
                      <div>
                        <div className="font-medium">{it.name} <span className="text-sm text-gray-600"> • ₹{it.price}</span></div>
                        <div className="text-xs text-gray-400">id: {it.externalId || it._id}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => toggleAvailable(it)} className={`px-3 py-1 rounded ${it.available ? "bg-red-500 text-white" : "bg-gray-200"}`}>
                          {it.available ? "Disable" : "Enable"}
                        </button>
                        <button onClick={() => editItem(it)} className="px-3 py-1 bg-yellow-500 text-white rounded">Edit</button>
                        <button onClick={() => deleteItem(it._id)} className="px-3 py-1 bg-gray-300 rounded">Delete</button>
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

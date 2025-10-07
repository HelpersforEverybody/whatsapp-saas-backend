import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://whatsapp-saas-backend-f9ot.onrender.com";

export default function OwnerDashboard() {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const token = localStorage.getItem("token");

  // Load only shops owned by logged-in merchant
  const loadMyShops = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/me/shops`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        alert("Session expired, please login again.");
        localStorage.clear();
        window.location.href = "/merchant-login";
        return;
      }
      const data = await res.json();
      setShops(data || []);
      if (data.length > 0) setSelectedShop(data[0]);
    } catch (err) {
      console.error("Failed to load shops:", err);
      alert("Failed to load shops (re-login if needed)");
    }
  };

  const loadMenu = async (shopId) => {
    if (!shopId) return;
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      const data = await res.json();
      setMenu(data);
    } catch (err) {
      console.error("Load menu failed:", err);
    }
  };

  const loadOrders = async (shopId) => {
    if (!shopId) return;
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        console.warn("Forbidden: not your shop");
        setOrders([]);
        return;
      }
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error("Load orders failed:", err);
    }
  };

  const addItem = async () => {
    if (!selectedShop || !itemName || !itemPrice) return alert("Enter item details");
    try {
      const res = await fetch(`${API_BASE}/api/shops/${selectedShop._id}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: itemName, price: Number(itemPrice) }),
      });
      if (!res.ok) throw new Error("Failed to add item");
      setItemName("");
      setItemPrice("");
      loadMenu(selectedShop._id);
    } catch (err) {
      console.error("Add item error:", err);
      alert("Failed to add item");
    }
  };

  const deleteItem = async (itemId) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      await fetch(`${API_BASE}/api/shops/${selectedShop._id}/items/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      loadMenu(selectedShop._id);
    } catch (err) {
      console.error("Delete item failed:", err);
    }
  };

  const toggleAvailability = async (itemId, available) => {
    try {
      await fetch(`${API_BASE}/api/shops/${selectedShop._id}/items/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ available: !available }),
      });
      loadMenu(selectedShop._id);
    } catch (err) {
      console.error("Toggle availability failed:", err);
    }
  };

  const editItem = async (itemId, oldName, oldPrice) => {
    const newName = prompt("Edit name:", oldName);
    const newPrice = prompt("Edit price:", oldPrice);
    if (!newName || !newPrice) return;
    try {
      await fetch(`${API_BASE}/api/shops/${selectedShop._id}/items/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName, price: Number(newPrice) }),
      });
      loadMenu(selectedShop._id);
    } catch (err) {
      console.error("Edit item failed:", err);
    }
  };

  useEffect(() => {
    loadMyShops();
  }, []);

  useEffect(() => {
    if (selectedShop?._id) {
      loadMenu(selectedShop._id);
      loadOrders(selectedShop._id);
    }
  }, [selectedShop]);

  return (
    <div className="p-6 max-w-7xl mx-auto bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Owner Dashboard</h2>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Column - Shops */}
        <div className="w-full md:w-1/3">
          <h3 className="font-semibold mb-2">Your Shops</h3>
          {shops.length === 0 && <p>Loading...</p>}
          {shops.map((shop) => (
            <div
              key={shop._id}
              onClick={() => setSelectedShop(shop)}
              className={`border rounded p-3 mb-2 cursor-pointer ${
                selectedShop?._id === shop._id ? "bg-blue-50 border-blue-400" : "hover:bg-gray-50"
              }`}
            >
              <div className="font-medium">{shop.name}</div>
              <div className="text-sm text-gray-500">{shop.phone}</div>
            </div>
          ))}

          <h3 className="font-semibold mt-4">Add Item to Selected Shop</h3>
          <input
            placeholder="Item name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="border p-2 rounded w-full mb-2"
          />
          <input
            placeholder="Price"
            value={itemPrice}
            onChange={(e) => setItemPrice(e.target.value)}
            className="border p-2 rounded w-full mb-2"
          />
          <button
            onClick={addItem}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Add Item
          </button>
        </div>

        {/* Right Column - Orders and Menu */}
        <div className="w-full md:w-2/3">
          <h3 className="font-semibold mb-2">
            Orders for {selectedShop ? selectedShop.name : "—"}
          </h3>
          {orders.length === 0 && <p className="text-gray-500">No orders</p>}
          {orders.map((order) => (
            <div key={order._id} className="border rounded p-2 mb-2">
              <div className="font-medium">
                Order #{order._id.slice(-6)} — {order.status}
              </div>
              <div className="text-sm text-gray-600">
                {order.items.map((i) => `${i.name} x${i.qty}`).join(", ")}
              </div>
            </div>
          ))}

          <h3 className="font-semibold mt-6">Menu for {selectedShop ? selectedShop.name : "—"}</h3>
          {menu.length === 0 && <p className="text-gray-500">No items</p>}
          {menu.map((item) => (
            <div
              key={item._id}
              className="border rounded p-3 mb-2 flex justify-between items-center"
            >
              <div>
                <div className="font-medium">
                  {item.name} • ₹{item.price}
                </div>
                <div className="text-xs text-gray-500">id: {item.externalId}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleAvailability(item._id, item.available)}
                  className="bg-red-500 text-white px-3 py-1 rounded"
                >
                  {item.available ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => editItem(item._id, item.name, item.price)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteItem(item._id)}
                  className="bg-gray-400 text-white px-3 py-1 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

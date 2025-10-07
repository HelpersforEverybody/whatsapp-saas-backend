import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://whatsapp-saas-backend-f9ot.onrender.com";

export default function ShopManager() {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [qtyMap, setQtyMap] = useState({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Load all shops (public)
  const loadShops = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/shops`);
      const data = await res.json();
      setShops(data || []);
      if (data.length > 0) setSelectedShop(data[0]);
    } catch (err) {
      console.error("Failed to load shops:", err);
    }
  };

  const loadMenu = async (shopId) => {
    if (!shopId) return;
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      const data = await res.json();
      setMenu(data);
    } catch (err) {
      console.error("Failed to load menu:", err);
    }
  };

  const handleQtyChange = (itemId, value) => {
    setQtyMap((prev) => ({
      ...prev,
      [itemId]: Math.max(0, Number(value) || 0),
    }));
  };

  // 🧾 Place one combined order for all items with qty > 0
  const placeCombinedOrder = async () => {
    if (!selectedShop) return alert("Select a shop first");
    if (!customerName || !customerPhone)
      return alert("Enter your name and phone before ordering");

    const selectedItems = menu
      .filter((item) => qtyMap[item._id] && qtyMap[item._id] > 0)
      .map((item) => ({
        name: item.name,
        qty: qtyMap[item._id],
        price: item.price,
      }));

    if (selectedItems.length === 0) return alert("Select at least one item to order");

    const payload = {
      shop: selectedShop._id,
      customerName,
      phone: customerPhone,
      items: selectedItems,
    };

    const total = selectedItems.reduce((sum, i) => sum + i.price * i.qty, 0);

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Order failed");
      const data = await res.json();
      alert(`✅ Order placed!\nTotal ₹${total}\nOrder ID: ${data._id}`);
      setQtyMap({});
    } catch (err) {
      console.error("Order failed:", err);
      alert("Failed to place order");
    }
  };

  useEffect(() => {
    loadShops();
  }, []);

  useEffect(() => {
    if (selectedShop?._id) loadMenu(selectedShop._id);
  }, [selectedShop]);

  return (
    <div className="p-6 max-w-6xl mx-auto bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Shops & Menu</h2>

      {/* Customer Info */}
      <div className="mb-6 border p-4 rounded bg-gray-50">
        <h3 className="font-semibold mb-2">Enter Your Details</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Your Name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="border p-2 rounded w-full sm:w-1/2"
          />
          <input
            type="text"
            placeholder="Your Phone (+91...)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="border p-2 rounded w-full sm:w-1/2"
          />
        </div>
      </div>

      {/* Shops List */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/3">
          <h3 className="font-semibold mb-2">Available Shops</h3>
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
              {shop.description && (
                <div className="text-xs text-gray-600 mt-1">{shop.description}</div>
              )}
            </div>
          ))}
        </div>

        {/* Menu */}
        <div className="w-full md:w-2/3">
          <h3 className="font-semibold mb-3">
            Menu for {selectedShop ? selectedShop.name : "—"}
          </h3>
          {menu.length === 0 && <p className="text-gray-500">No items available</p>}
          {menu.map((item) => (
            <div
              key={item._id}
              className="border rounded p-3 mb-3 flex flex-col sm:flex-row justify-between sm:items-center"
            >
              <div>
                <div className="font-medium">
                  {item.name} • ₹{item.price}
                </div>
                <div className="text-xs text-gray-500">
                  {item.available ? "Available" : "Unavailable"}
                </div>
              </div>

              <div className="flex gap-2 mt-2 sm:mt-0 sm:items-center">
                <input
                  type="number"
                  min="0"
                  value={qtyMap[item._id] || ""}
                  onChange={(e) => handleQtyChange(item._id, e.target.value)}
                  className="border p-1 w-20 text-center rounded"
                  placeholder="Qty"
                />
              </div>
            </div>
          ))}

          {menu.length > 0 && (
            <div className="mt-4 text-right">
              <button
                onClick={placeCombinedOrder}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded text-lg"
              >
                Place Order
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

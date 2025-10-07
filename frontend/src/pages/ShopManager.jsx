// frontend/src/pages/ShopsAndMenu.jsx
import React, { useEffect, useState } from "react";
import { getApiBase } from "../hooks/useApi";

export default function ShopsAndMenu() {
  const API_BASE = getApiBase();
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [loading, setLoading] = useState(false);

  // Load all shops
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/shops`);
        const data = await res.json();
        setShops(data);
      } catch (err) {
        console.error(err);
        alert("Failed to load shops");
      }
    })();
  }, []);

  // Load menu for selected shop
  async function loadMenu(shop) {
    setSelectedShop(shop);
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shop._id}/menu`);
      const data = await res.json();
      setMenu(data);
      setCart({});
    } catch (err) {
      console.error(err);
      alert("Failed to load menu");
    }
  }

  // Update quantity in cart
  function updateQty(itemId, change) {
    setCart((prev) => {
      const next = { ...prev };
      next[itemId] = Math.max(0, (next[itemId] || 0) + change);
      return next;
    });
  }

  // Place order
  async function placeOrder() {
    if (!selectedShop) return alert("Select a shop first");
    const items = menu
      .filter((m) => cart[m._id] > 0)
      .map((m) => ({
        name: m.name,
        qty: cart[m._id],
        price: m.price,
      }));
    if (!items.length) return alert("Please add at least one item");
    if (!customer.name || !customer.phone)
      return alert("Enter your name and phone");

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: selectedShop._id,
          items,
          customerName: customer.name,
          phone: customer.phone,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      alert("✅ Order placed successfully!");
      // Clear cart and customer info (Option 1 behavior)
      setCart({});
      setCustomer({ name: "", phone: "" });
    } catch (err) {
      console.error(err);
      alert("Failed to place order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">🛍 Shops & Menu</h2>

        {/* Shop List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {shops.map((s) => (
            <div
              key={s._id}
              onClick={() => loadMenu(s)}
              className={`p-3 border rounded cursor-pointer ${
                selectedShop && selectedShop._id === s._id
                  ? "bg-blue-50 border-blue-400"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-gray-500">{s.phone}</div>
            </div>
          ))}
        </div>

        {/* Menu Section */}
        {selectedShop && (
          <>
            <h3 className="font-semibold text-lg mb-2">
              Menu for {selectedShop.name}
            </h3>
            <div className="space-y-3 mb-6">
              {menu.length === 0 ? (
                <div>No items found.</div>
              ) : (
                menu.map((m) => (
                  <div
                    key={m._id}
                    className="flex justify-between items-center border p-3 rounded"
                  >
                    <div>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-sm text-gray-600">
                        ₹{m.price} • id: {m.externalId}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 border rounded"
                        onClick={() => updateQty(m._id, -1)}
                      >
                        -
                      </button>
                      <span>{cart[m._id] || 0}</span>
                      <button
                        className="px-2 py-1 border rounded"
                        onClick={() => updateQty(m._id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Customer Info + Place Order */}
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Customer Details</h4>
              <input
                placeholder="Your Name"
                value={customer.name}
                onChange={(e) =>
                  setCustomer({ ...customer, name: e.target.value })
                }
                className="w-full border p-2 rounded mb-2"
              />
              <input
                placeholder="Phone (+91...)"
                value={customer.phone}
                onChange={(e) =>
                  setCustomer({ ...customer, phone: e.target.value })
                }
                className="w-full border p-2 rounded mb-3"
              />
              <button
                disabled={loading}
                onClick={placeOrder}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                {loading ? "Placing..." : "Place Order"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// frontend/src/pages/ShopManager.jsx
import React, { useEffect, useState } from "react";
import { getApiBase } from "../hooks/useApi";

const API_BASE = getApiBase();
const API_KEY = import.meta.env.VITE_API_KEY || "";

export default function ShopManager() {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(false);

  // customer info (simple)
  const [customerName, setCustomerName] = useState("");
  // NOTE: we keep an internal "digitsOnlyPhone" (exactly up to 10 digits). On blur we convert to E.164 for submitting.
  const [digitsOnlyPhone, setDigitsOnlyPhone] = useState("");

  // cart: { itemId: qty }
  const [cart, setCart] = useState({});

  useEffect(() => {
    loadShops();
  }, []);

  useEffect(() => {
    if (selectedShop) {
      loadMenu(selectedShop._id);
      setCart({}); // clear cart when shop changes
    } else {
      setMenu([]);
      setCart({});
    }
  }, [selectedShop]);

  async function loadShops() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/shops`);
      if (!res.ok) throw new Error("Failed to load shops");
      const data = await res.json();
      setShops(data);
      if (data.length) setSelectedShop(data[0]);
    } catch (e) {
      console.error("Load shops error", e);
      alert("Failed to load shops");
    } finally {
      setLoading(false);
    }
  }

  async function loadMenu(shopId) {
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      setMenu(data);
    } catch (e) {
      console.error("Load menu error", e);
      alert("Failed to load menu");
    }
  }

  // Cart helpers
  function getQty(itemId) {
    return Number(cart[itemId] || 0);
  }

  function setQty(itemId, qty) {
    setCart(prev => {
      const copy = { ...prev };
      if (!qty || qty <= 0) {
        delete copy[itemId];
      } else {
        copy[itemId] = Number(qty);
      }
      return copy;
    });
  }

  function increment(itemId) {
    const cur = getQty(itemId);
    setQty(itemId, cur + 1);
  }

  function decrement(itemId) {
    const cur = getQty(itemId);
    setQty(itemId, Math.max(0, cur - 1));
  }

  function addInitial(itemId) {
    // set to 1 to convert Add -> controls
    setQty(itemId, 1);
  }

  function cartItemsArray() {
    // convert cart object to [{ itemId, qty, name, price }]
    return Object.keys(cart).map(id => {
      const qty = cart[id];
      const item = menu.find(m => String(m._id) === String(id));
      return {
        _id: id,
        qty,
        name: item ? item.name : "Item",
        price: item ? Number(item.price || 0) : 0,
      };
    });
  }

  function cartSummary() {
    const items = cartItemsArray();
    const totalQty = items.reduce((s, i) => s + i.qty, 0);
    const totalPrice = items.reduce((s, i) => s + i.qty * i.price, 0);
    return { totalQty, totalPrice, items };
  }

  // phone input handling (frontend validation)
  // The user types up to 10 digits. We only allow digits in this field.
  function handlePhoneChange(e) {
    const raw = e.target.value || "";
    // strip non-digits
    const digits = raw.replace(/\D/g, "");
    // limit to 10 digits
    const limited = digits.slice(0, 10);
    setDigitsOnlyPhone(limited);
  }

  // On blur: if exactly 10 digits, keep them (we normalize during placeOrder to +91...).
  // If fewer than 10, leave as-is (placeOrder will reject).
  function handlePhoneBlur() {
    // no-op on blur for UI (we already restrict input). We validate on placeOrder.
  }

  // Build normalized phone for server: if digitsOnlyPhone has 10 digits -> +91XXXXXXXXXX
  // If user accidentally typed full E.164 into digitsOnlyPhone (shouldn't happen), we handle.
  function normalizedPhoneForSubmit() {
    const d = (digitsOnlyPhone || "").replace(/\D/g, "");
    if (d.length === 10) return `+91${d}`;
    // fallback: try to detect if digitsOnlyPhone already has an international code (rare here)
    return `+${d}`; // server will validate and may reject
  }

  async function placeOrder() {
    if (!selectedShop) return alert("Select a shop");
    const { items } = cartSummary();
    if (!items.length) return alert("Cart is empty");
    if (!customerName) return alert("Enter your name");

    // phone validation client-side: require exactly 10 digits (we will submit +91 prefix)
    const digits = (digitsOnlyPhone || "").replace(/\D/g, "");
    if (digits.length !== 10) {
      return alert("Enter a valid 10-digit phone number (without +91). We will prefix +91 automatically.");
    }

    const payload = {
      shop: selectedShop._id,
      customerName,
      phone: normalizedPhoneForSubmit(),
      items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    };

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // intentionally do not send x-api-key or Authorization here — guests allowed
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Order failed");
      }
      const order = await res.json();
      alert("Order placed: " + (order.orderNumber ? `#${String(order.orderNumber).padStart(6, "0")}` : (order._id ? String(order._id).slice(0,8) : "OK")));
      setCart({});
      // optionally clear customer info? keep as-is
    } catch (e) {
      console.error("Order failed", e);
      alert("Order failed: " + (e.message || e));
    }
  }

  // helper to render quantity control or Add button
  function QtyControl({ item }) {
    const id = item._id;
    const available = Boolean(item.available);
    const qty = getQty(id);

    // if unavailable: show disabled Add button
    if (!available) {
      return (
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 bg-gray-300 text-gray-700 rounded" disabled>
            Unavailable
          </button>
        </div>
      );
    }

    if (!qty || qty <= 0) {
      return (
        <div>
          <button
            onClick={() => addInitial(id)}
            className="px-3 py-1 bg-green-600 text-white rounded"
          >
            Add
          </button>
        </div>
      );
    }

    // show [-] qty [+]
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => decrement(id)}
          className="px-2 py-1 bg-gray-200 rounded"
          aria-label="decrement"
        >
          −
        </button>
        <div className="px-3 py-1 border rounded">{qty}</div>
        <button
          onClick={() => increment(id)}
          className="px-2 py-1 bg-gray-200 rounded"
          aria-label="increment"
        >
          +
        </button>
      </div>
    );
  }

  const { totalQty, totalPrice } = cartSummary();

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-semibold mb-4">Shops & Menu</h1>

        <div className="mb-4 p-4 border rounded bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Your Name"
              className="p-2 border rounded w-full"
            />
            <input
              value={digitsOnlyPhone}
              onChange={handlePhoneChange}
              onBlur={handlePhoneBlur}
              placeholder="Your Phone (10 digits — will auto-prefix +91 on submit)"
              className="p-2 border rounded w-full"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1">
            <h3 className="font-medium mb-2">Available Shops</h3>

            {loading ? <div>Loading...</div> : shops.length === 0 ? <div>No shops</div> :
              shops.map(s => (
                <div
                  key={s._id}
                  className={`p-3 mb-3 border rounded cursor-pointer ${selectedShop && selectedShop._id === s._id ? "bg-blue-50" : ""}`}
                  onClick={() => setSelectedShop(s)}
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.phone}</div>
                  {s.description ? <div className="text-xs text-gray-400">{s.description}</div> : null}
                </div>
              ))
            }
          </div>

          <div className="col-span-2">
            <h3 className="font-medium mb-2">Menu for {selectedShop ? selectedShop.name : "—"}</h3>

            {selectedShop === null ? (
              <div>Select a shop to view its menu</div>
            ) : menu.length === 0 ? (
              <div>No items</div>
            ) : (
              <div className="space-y-3">
                {menu.map(item => (
                  <div key={item._id} className="p-3 border rounded flex justify-between items-center">
                    <div>
                      <div className="font-medium">{item.name} • ₹{item.price}</div>
                      <div className="text-xs text-gray-500">{item.available ? "Available" : "Unavailable"}</div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* quantity control / add button */}
                      <QtyControl item={item} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Cart summary & Place order */}
            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Cart: <b>{totalQty}</b> items</div>
                <div className="text-sm text-gray-800">Total: <b>₹{totalPrice}</b></div>
              </div>

              <div>
                <button
                  onClick={placeOrder}
                  className="px-4 py-2 bg-green-600 text-white rounded"
                >
                  Place Order
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

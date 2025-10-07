// frontend/src/pages/ShopManager.jsx
import React, { useEffect, useState } from "react";
import { getApiBase } from "../hooks/useApi";

const API_BASE = getApiBase();

export default function ShopManager() {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [digitsOnlyPhone, setDigitsOnlyPhone] = useState("");
  const [phoneError, setPhoneError] = useState(""); // 🟢 new: to store validation message

  const [cart, setCart] = useState({});

  useEffect(() => {
    loadShops();
  }, []);

  useEffect(() => {
    if (selectedShop) {
      loadMenu(selectedShop._id);
      setCart({});
    } else {
      setMenu([]);
      setCart({});
    }
  }, [selectedShop]);

  async function loadShops() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/shops`);
      const data = await res.json();
      setShops(data);
      if (data.length) setSelectedShop(data[0]);
    } catch {
      alert("Failed to load shops");
    } finally {
      setLoading(false);
    }
  }

  async function loadMenu(shopId) {
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      const data = await res.json();
      setMenu(data);
    } catch {
      alert("Failed to load menu");
    }
  }

  function getQty(id) {
    return Number(cart[id] || 0);
  }

  function setQty(id, qty) {
    setCart(prev => {
      const copy = { ...prev };
      if (qty <= 0) delete copy[id];
      else copy[id] = qty;
      return copy;
    });
  }

  function increment(id) {
    setQty(id, getQty(id) + 1);
  }

  function decrement(id) {
    setQty(id, Math.max(0, getQty(id) - 1));
  }

  function addInitial(id) {
    setQty(id, 1);
  }

  const cartItems = Object.keys(cart).map(id => {
    const item = menu.find(m => m._id === id);
    return { ...item, qty: cart[id] };
  });

  const totalQty = cartItems.reduce((s, i) => s + i.qty, 0);
  const totalPrice = cartItems.reduce((s, i) => s + i.qty * i.price, 0);

  // ---------------- Phone input logic ----------------
  function handlePhoneChange(e) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
    setDigitsOnlyPhone(raw);
    if (raw.length === 10) setPhoneError(""); // clear error when valid
  }

  function normalizedPhoneForSubmit() {
    const d = digitsOnlyPhone.replace(/\D/g, "");
    if (d.length === 10) return `+91${d}`;
    return `+${d}`;
  }

  // ---------------- Place Order ----------------
  async function placeOrder() {
    if (!selectedShop) return alert("Select a shop");
    if (!cartItems.length) return alert("Cart is empty");
    if (!customerName) return alert("Enter your name");

    const digits = digitsOnlyPhone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setPhoneError("Enter a valid 10-digit phone number"); // 🟥 inline error
      return;
    }

    const payload = {
      shop: selectedShop._id,
      customerName,
      phone: normalizedPhoneForSubmit(),
      items: cartItems.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    };

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const order = await res.json();
      alert(
        "Order placed: " +
          (order.orderNumber
            ? `#${String(order.orderNumber).padStart(6, "0")}`
            : order._id.slice(0, 8))
      );
      setCart({});
      setDigitsOnlyPhone("");
      setPhoneError("");
    } catch (e) {
      alert("Order failed: " + e.message);
    }
  }

  // ---------------- Quantity Controls ----------------
  function QtyControl({ item }) {
    const qty = getQty(item._id);
    if (!item.available)
      return (
        <button disabled className="px-3 py-1 bg-gray-300 text-gray-700 rounded">
          Unavailable
        </button>
      );
    if (!qty)
      return (
        <button
          onClick={() => addInitial(item._id)}
          className="px-3 py-1 bg-green-600 text-white rounded"
        >
          Add
        </button>
      );
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => decrement(item._id)}
          className="px-2 py-1 bg-gray-200 rounded"
        >
          −
        </button>
        <div className="px-3 py-1 border rounded">{qty}</div>
        <button
          onClick={() => increment(item._id)}
          className="px-2 py-1 bg-gray-200 rounded"
        >
          +
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-semibold mb-4">Shops & Menu</h1>

        {/* -------- Customer Input Section -------- */}
        <div className="mb-4 p-4 border rounded bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <input
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Your Name"
              className="p-2 border rounded w-full"
            />

            <div className="w-full">
              <div className="flex items-center">
                <div className="px-3 py-2 bg-gray-100 border rounded-l text-gray-700 select-none">
                  +91
                </div>
                <input
                  value={digitsOnlyPhone}
                  onChange={handlePhoneChange}
                  placeholder="Phone (10 digits)"
                  className={`p-2 border rounded-r w-full ${
                    phoneError ? "border-red-500" : ""
                  }`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                />
              </div>
              {/* 🟢 Inline error message */}
              {phoneError && (
                <div className="text-red-600 text-sm mt-1">{phoneError}</div>
              )}
            </div>
          </div>
        </div>

        {/* -------- Shops & Menu -------- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h3 className="font-medium mb-2">Available Shops</h3>
            {loading ? (
              <div>Loading...</div>
            ) : shops.length === 0 ? (
              <div>No shops</div>
            ) : (
              shops.map(s => (
                <div
                  key={s._id}
                  onClick={() => setSelectedShop(s)}
                  className={`p-3 mb-3 border rounded cursor-pointer ${
                    selectedShop && selectedShop._id === s._id
                      ? "bg-blue-50"
                      : ""
                  }`}
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.phone}</div>
                </div>
              ))
            )}
          </div>

          <div className="col-span-2">
            <h3 className="font-medium mb-2">
              Menu for {selectedShop ? selectedShop.name : "—"}
            </h3>

            {selectedShop === null ? (
              <div>Select a shop to view its menu</div>
            ) : menu.length === 0 ? (
              <div>No items</div>
            ) : (
              <div className="space-y-3">
                {menu.map(item => (
                  <div
                    key={item._id}
                    className="p-3 border rounded flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">
                        {item.name} • ₹{item.price}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.available ? "Available" : "Unavailable"}
                      </div>
                    </div>
                    <QtyControl item={item} />
                  </div>
                ))}
              </div>
            )}

            {/* -------- Cart summary -------- */}
            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">
                  Cart: <b>{totalQty}</b> items
                </div>
                <div className="text-sm text-gray-800">
                  Total: <b>₹{totalPrice}</b>
                </div>
              </div>
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
  );
}

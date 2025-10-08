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
  const [customerPhone, setCustomerPhone] = useState("");
  // start empty — do NOT auto-apply saved pincode on load
  const [pincode, setPincode] = useState("");
  const [pincodeErr, setPincodeErr] = useState("");

  // cart: { itemId: qty }
  const [cart, setCart] = useState({});

  // On mount: load all shops (no pincode applied)
  useEffect(() => {
    loadShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      let url = `${API_BASE}/api/shops`;
      // Only append pincode if user has applied it (non-empty)
      if (pincode && pincode.trim()) {
        const pin = String(pincode).trim();
        url += `?pincode=${encodeURIComponent(pin)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load shops");
      const data = await res.json();
      setShops(data);
      if (data.length) {
        // preserve previous selected shop if present, else pick first
        const found = selectedShop && data.find(s => selectedShop && s._id === selectedShop._id) ? data.find(s => s._id === selectedShop._id) : data[0];
        setSelectedShop(found);
      } else {
        setSelectedShop(null);
      }
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

  // Validate 6-digit pincode
  function validatePincode(pin) {
    if (!pin) return true; // treat empty as valid
    return /^\d{6}$/.test(pin.trim());
  }

  function setAndApplyPincode(pin) {
    setPincode(pin);
    // persist chosen pincode (so user sees it next visit) — optional
    localStorage.setItem("customer_pincode", pin || "");
  }

  // auto-prefix phone on blur: if 10 digits and no +, add +91
  function handlePhoneBlur() {
    const v = (customerPhone || "").trim();
    if (!v) return;
    if (v.startsWith("+")) return;
    const digits = v.replace(/\D/g, "");
    if (digits.length === 10) {
      setCustomerPhone("+91" + digits);
    }
  }

  async function placeOrder(setInlineError) {
    // setInlineError is optional function to set inline message under phone input
    if (!selectedShop) {
      if (setInlineError) setInlineError("Select a shop");
      else alert("Select a shop");
      return;
    }
    const { items } = cartSummary();
    if (!items.length) {
      if (setInlineError) setInlineError("Cart is empty");
      else alert("Cart is empty");
      return;
    }
    // phone validation: must be +91xxxxxxxxxx or 10 digits
    const phoneDigits = (customerPhone || "").replace(/\D/g, "");
    if (!(phoneDigits.length === 10 || (customerPhone || "").startsWith("+91"))) {
      if (setInlineError) setInlineError("Enter valid 10-digit phone number (we prefix +91)");
      else alert("Enter valid phone");
      return;
    }

    if (!validatePincode(pincode)) {
      if (setInlineError) setInlineError("Enter a 6-digit pincode");
      else alert("Invalid pincode");
      return;
    }

    const payload = {
      shop: selectedShop._id,
      customerName,
      phone: customerPhone,
      items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    };

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY // leave API_KEY if you use server API key for public requests; otherwise server accepts guest orders
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Order failed");
      }
      const order = await res.json();
      alert("Order placed: " + (order.orderNumber ? `#${String(order.orderNumber).padStart(6,'0')}` : String(order._id).slice(0,8)));
      setCart({});
    } catch (e) {
      console.error("Order failed", e);
      if (setInlineError) setInlineError("Order failed: " + (e.message || e));
      else alert("Order failed: " + (e.message || e));
    }
  }

  // helper to render quantity control or Add button
  function QtyControl({ item }) {
    const id = item._id;
    const available = Boolean(item.available);
    const qty = getQty(id);

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

    return (
      <div className="flex items-center gap-2">
        <button onClick={() => decrement(id)} className="px-2 py-1 bg-gray-200 rounded" aria-label="decrement">−</button>
        <div className="px-3 py-1 border rounded">{qty}</div>
        <button onClick={() => increment(id)} className="px-2 py-1 bg-gray-200 rounded" aria-label="increment">+</button>
      </div>
    );
  }

  const { totalQty, totalPrice } = cartSummary();
  const [inlinePhoneError, setInlinePhoneError] = useState("");

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-semibold mb-4">Shops & Menu</h1>

        <div className="mb-4 p-4 border rounded bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Your Name"
              className="p-2 border rounded w-full"
            />
          <div>
  <label className="block text-sm text-gray-600 mb-1">Phone Number</label>
  <div className="flex items-center border rounded overflow-hidden">
    <span className="px-3 py-2 bg-gray-100 text-gray-700 select-none">+91</span>
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength="10"
      value={customerPhone}
      onChange={(e) => {
        // remove any non-digits and limit to 10
        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
        setCustomerPhone(digits);
        setInlinePhoneError("");
      }}
      placeholder="Enter 10-digit number"
      className="p-2 flex-1 outline-none"
    />
  </div>
  {inlinePhoneError ? (
    <div className="text-sm text-red-600 mt-1">{inlinePhoneError}</div>
  ) : null}
</div>

            <div>
              <input
                value={pincode}
                onChange={(e) => { setPincode(e.target.value.replace(/\D/g, '').slice(0,6)); setPincodeErr(""); }}
                placeholder="Filter by pincode (6 digits)"
                className="p-2 border rounded w-full"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={() => {
                  if (!validatePincode(pincode)) { setPincodeErr("Enter 6 digits"); return; }
                  // persist and apply
                  setAndApplyPincode(pincode);
                  loadShops();
                }} className="px-3 py-1 bg-blue-600 text-white rounded">Apply</button>
                <button onClick={() => { setPincode(''); setAndApplyPincode(''); loadShops(); }} className="px-3 py-1 bg-gray-200 rounded">Clear</button>
              </div>
              {pincodeErr ? <div className="text-sm text-red-600 mt-1">{pincodeErr}</div> : null}
            </div>
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
                  <div className="text-xs text-gray-500">{s.phone} • {s.pincode || "—"}</div>
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
                  onClick={() => placeOrder(setInlinePhoneError)}
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

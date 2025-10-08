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
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pincode, setPincode] = useState(localStorage.getItem("customer_pincode") || "");
  const [cart, setCart] = useState({});
  const [inlinePhoneError, setInlinePhoneError] = useState("");

  useEffect(() => { loadShops(); }, []);
  useEffect(() => { if (selectedShop) { loadMenu(selectedShop._id); setCart({}); } else { setMenu([]); setCart({}); } }, [selectedShop]);

  async function loadShops() {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/shops`;
      if (pincode && pincode.trim()) url += `?pincode=${encodeURIComponent(pincode.trim())}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load shops");
      const data = await res.json();
      setShops(data);
      if (data.length) {
        const found = data.find(s => selectedShop && s._id === selectedShop._id) || data[0];
        setSelectedShop(found);
      } else setSelectedShop(null);
    } catch (e) {
      console.error("Load shops error", e);
      alert("Failed to load shops");
    } finally { setLoading(false); }
  }

  async function loadMenu(shopId) {
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      setMenu(data);
    } catch (e) { console.error("Load menu error", e); alert("Failed to load menu"); }
  }

  function getQty(itemId) { return Number(cart[itemId] || 0); }
  function setQty(itemId, qty) { setCart(prev => { const copy = {...prev}; if (!qty || qty <= 0) delete copy[itemId]; else copy[itemId] = Number(qty); return copy; }); }
  function increment(itemId) { setQty(itemId, getQty(itemId) + 1); }
  function decrement(itemId) { setQty(itemId, Math.max(0, getQty(itemId) - 1)); }
  function addInitial(itemId) { setQty(itemId, 1); }
  function cartItemsArray() { return Object.keys(cart).map(id => { const qty = cart[id]; const item = menu.find(m => String(m._id) === String(id)); return { _id: id, qty, name: item ? item.name : "Item", price: item ? Number(item.price || 0) : 0 }; }); }
  function cartSummary() { const items = cartItemsArray(); const totalQty = items.reduce((s,i) => s + i.qty, 0); const totalPrice = items.reduce((s,i) => s + i.qty * i.price, 0); return { totalQty, totalPrice, items }; }

  function validatePincode(pin) { if (!pin) return true; return /^\d{6}$/.test(pin.trim()); }
  function setAndApplyPincode(pin) { setPincode(pin); localStorage.setItem("customer_pincode", pin || ""); }

  function handlePhoneBlur() {
    const v = (customerPhone || "").trim();
    if (!v) return;
    if (v.startsWith("+")) return;
    const digits = v.replace(/\D/g, "");
    if (digits.length === 10) setCustomerPhone("+91" + digits);
  }

  async function placeOrder(setInlineError) {
    if (!selectedShop) { if (setInlineError) setInlineError("Select a shop"); else alert("Select a shop"); return; }
    const { items } = cartSummary();
    if (!items.length) { if (setInlineError) setInlineError("Cart is empty"); else alert("Cart is empty"); return; }
    const phoneDigits = (customerPhone || "").replace(/\D/g, "");
    if (!(phoneDigits.length === 10 || (customerPhone || "").startsWith("+91"))) { if (setInlineError) setInlineError("Enter valid 10-digit phone number"); else alert("Enter valid phone"); return; }
    if (!validatePincode(pincode)) { if (setInlineError) setInlineError("Enter a 6-digit pincode"); else alert("Invalid pincode"); return; }

    const payload = { shop: selectedShop._id, customerName, phone: customerPhone, items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })) };
    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const txt = await res.text(); throw new Error(txt || "Order failed"); }
      const order = await res.json();
      alert("Order placed: " + (order.orderNumber ? `#${String(order.orderNumber).padStart(6,'0')}` : String(order._id).slice(0,8)));
      setCart({});
    } catch (e) {
      console.error("Order failed", e);
      if (setInlineError) setInlineError("Order failed: " + (e.message || e)); else alert("Order failed: " + (e.message || e));
    }
  }

  function QtyControl({ item }) {
    const id = item._id;
    const available = Boolean(item.available);
    const qty = getQty(id);
    if (!available) return <div className="flex items-center gap-2"><button className="px-3 py-1 bg-gray-300 text-gray-700 rounded" disabled>Unavailable</button></div>;
    if (!qty || qty <= 0) return <div><button onClick={() => addInitial(id)} className="px-3 py-1 bg-green-600 text-white rounded">Add</button></div>;
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => decrement(id)} className="px-2 py-1 bg-gray-200 rounded" aria-label="decrement">−</button>
        <div className="px-3 py-1 border rounded">{qty}</div>
        <button onClick={() => increment(id)} className="px-2 py-1 bg-gray-200 rounded" aria-label="increment">+</button>
      </div>
    );
  }

  const { totalQty, totalPrice } = cartSummary();

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-semibold mb-4">Shops & Menu</h1>

        <div className="mb-4 p-4 border rounded bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Your Name" className="p-2 border rounded w-full" />
            <div>
              <input value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value); setInlinePhoneError(""); }} onBlur={handlePhoneBlur} placeholder="Your Phone (10 digits will auto-prefix +91 on blur)" className="p-2 border rounded w-full" />
              {inlinePhoneError ? <div className="text-sm text-red-600 mt-1">{inlinePhoneError}</div> : null}
            </div>
            <div>
              <input value={pincode} onChange={(e) => { setPincode(e.target.value.replace(/\D/g, '').slice(0,6)); }} placeholder="Filter by pincode (6 digits)" className="p-2 border rounded w-full" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => { if (!validatePincode(pincode)) { alert("Enter 6 digits"); return; } setAndApplyPincode(pincode); loadShops(); }} className="px-3 py-1 bg-blue-600 text-white rounded">Apply</button>
                <button onClick={() => { setPincode(''); setAndApplyPincode(''); loadShops(); }} className="px-3 py-1 bg-gray-200 rounded">Clear</button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1">
            <h3 className="font-medium mb-2">Available Shops</h3>
            {loading ? <div>Loading...</div> : shops.length === 0 ? <div>No shops</div> : shops.map(s => (
              <div key={s._id} className={`p-3 mb-3 border rounded cursor-pointer ${selectedShop && selectedShop._id === s._id ? "bg-blue-50" : ""}`} onClick={() => setSelectedShop(s)}>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-gray-500">{s.phone} • {s.pincode || "—"}</div>
                {s.description ? <div className="text-xs text-gray-400">{s.description}</div> : null}
              </div>
            ))}
          </div>

          <div className="col-span-2">
            <h3 className="font-medium mb-2">Menu for {selectedShop ? selectedShop.name : "—"}</h3>
            {selectedShop === null ? <div>Select a shop to view its menu</div> : menu.length === 0 ? <div>No items</div> : (
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

            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Cart: <b>{totalQty}</b> items</div>
                <div className="text-sm text-gray-800">Total: <b>₹{totalPrice}</b></div>
              </div>
              <div>
                <button onClick={() => placeOrder(setInlinePhoneError)} className="px-4 py-2 bg-green-600 text-white rounded">Place Order</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  // store only 10-digit numeric string here (we show +91 in UI)
  const [customerPhone, setCustomerPhone] = useState("");
  // start empty — do NOT auto-apply saved pincode on load
  const [pincode, setPincode] = useState("");
  const [pincodeErr, setPincodeErr] = useState("");

  // cart: { itemId: qty }
  const [cart, setCart] = useState({});

  // inline errors
  const [inlinePhoneError, setInlinePhoneError] = useState("");

  // Auth + address states
  const [customerToken, setCustomerToken] = useState(localStorage.getItem("customer_token") || "");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpPhone, setOtpPhone] = useState(""); // normalized +91... used for verify
  const [otpDigitsInput, setOtpDigitsInput] = useState(""); // digits only (10) for send action
  const [otpCode, setOtpCode] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [customerAddress, setCustomerAddress] = useState(localStorage.getItem("customer_address") || "");
  const [addressMsg, setAddressMsg] = useState("");

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
        // preserve previous selected shop when possible, else pick first
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

  // auto-prefix phone on blur: if 10 digits and no +, add +91 to internal storage when needed
  function handlePhoneBlur() {
    // We store only digits in customerPhone state; when needed we prefix +91 when sending
    const v = (customerPhone || "").trim();
    if (!v) return;
    const digits = v.replace(/\D/g, "");
    if (digits.length === 10) {
      setCustomerPhone(digits.slice(-10));
    }
  }

  // ---- Auth (OTP) helpers ----
  async function sendOtpToPhone(digits10) {
    setAuthMsg("");
    try {
      const digits = String(digits10 || "").replace(/\D/g, "").slice(-10);
      if (digits.length !== 10) {
        setAuthMsg("Enter 10 digits to send OTP");
        return;
      }
      const normalized = `+91${digits}`;
      // call backend
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to send OTP");
      }
      setOtpSent(true);
      setOtpPhone(normalized);
      setOtpDigitsInput(digits);
      setAuthMsg("OTP sent (demo: check server logs).");
    } catch (e) {
      console.error("sendOtp error", e);
      setAuthMsg("Error sending OTP: " + (e.message || e));
    }
  }

  async function verifyOtpAndLogin() {
    setAuthMsg("");
    try {
      if (!otpPhone || !otpCode) return setAuthMsg("Phone and OTP required");
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: otpPhone, otp: otpCode }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "OTP verify failed");
      }
      const data = await res.json(); // { token, userId }
      if (!data.token) throw new Error("No token returned");
      localStorage.setItem("customer_token", data.token);
      setCustomerToken(data.token);
      setAuthModalOpen(false);
      setOtpSent(false);
      setOtpCode("");
      setAuthMsg("Logged in");
      // set phone input to digits only (strip +91)
      setCustomerPhone((otpPhone || "").replace(/\D/g, "").slice(-10));
    } catch (e) {
      console.error("verifyOtp error", e);
      setAuthMsg("Verify failed: " + (e.message || e));
    }
  }

  function logoutCustomer() {
    localStorage.removeItem("customer_token");
    setCustomerToken("");
  }

  // Address helpers
  function openAddressModalIfNeeded() {
    const addr = localStorage.getItem("customer_address") || customerAddress || "";
    if (!addr || addr.trim().length < 5) {
      setAddressModalOpen(true);
      return false;
    }
    setCustomerAddress(addr);
    return true;
  }

  function saveAddressAndClose() {
    if (!customerAddress || customerAddress.trim().length < 5) {
      setAddressMsg("Address is required (min 5 chars)");
      return;
    }
    localStorage.setItem("customer_address", customerAddress.trim());
    setAddressModalOpen(false);
    setAddressMsg("");
  }

  // Place order now guarded by auth & address
  async function placeOrder(setInlineError) {
    // require login first
    if (!customerToken) {
      setAuthModalOpen(true);
      return;
    }

    // require address
    const savedAddr = localStorage.getItem("customer_address") || customerAddress || "";
    if (!savedAddr || savedAddr.trim().length < 5) {
      setAddressModalOpen(true);
      return;
    }

    // continue validation
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
    // phone validation: require 10 digits stored in customerPhone
    const phoneDigits = (customerPhone || "").replace(/\D/g, "");
    if (!(phoneDigits.length === 10)) {
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
      phone: `+91${phoneDigits}`,
      address: savedAddr.trim(),
      items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    };

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          ...(customerToken ? { Authorization: `Bearer ${customerToken}` } : {}),
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

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-semibold mb-4">Shops & Menu</h1>

        {/* Top form */}
        <div className="mb-4 p-4 border rounded bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Your Name"
              className="p-2 border rounded w-full"
            />

            {/* Phone input with +91 prefix visible */}
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
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setCustomerPhone(digits);
                    setInlinePhoneError("");
                  }}
                  onBlur={handlePhoneBlur}
                  placeholder="Enter 10-digit number"
                  className="p-2 flex-1 outline-none"
                />
              </div>
              {inlinePhoneError ? (
                <div className="text-sm text-red-600 mt-1">{inlinePhoneError}</div>
              ) : null}
              {/* show login badge when logged in */}
              {customerToken ? (
                <div className="text-xs text-green-700 mt-1">Logged in</div>
              ) : (
                <div className="text-xs text-gray-600 mt-1">You will be asked to login before placing order</div>
              )}
            </div>

            {/* Pincode */}
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

        {/* Auth modal */}
        {authModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white p-4 rounded w-[420px]">
              <h3 className="font-semibold mb-2">Login / Verify by OTP</h3>

              {!otpSent ? (
                <>
                  <div className="text-sm text-gray-600 mb-2">Enter phone to receive OTP</div>
                  <div className="flex gap-2">
                    <span className="px-3 py-2 bg-gray-100 select-none">+91</span>
                    <input
                      value={otpDigitsInput || customerPhone}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setOtpDigitsInput(d);
                      }}
                      placeholder="10-digit phone"
                      className="p-2 border rounded flex-1"
                    />
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => { setAuthModalOpen(false); setAuthMsg(""); setOtpDigitsInput(""); }} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
                    <button onClick={() => sendOtpToPhone(otpDigitsInput || customerPhone)} className="px-3 py-1 bg-blue-600 text-white rounded">Send OTP</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-gray-600 mb-2">Enter the 6-digit OTP sent to {otpPhone}</div>
                  <input value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="OTP" className="p-2 border rounded w-full mb-3" />
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">{authMsg}</div>
                    <div className="flex gap-2">
                      <button onClick={() => { setOtpSent(false); setOtpCode(""); setAuthMsg(""); }} className="px-3 py-1 bg-gray-200 rounded">Back</button>
                      <button onClick={verifyOtpAndLogin} className="px-3 py-1 bg-green-600 text-white rounded">Verify & Login</button>
                    </div>
                  </div>
                </>
              )}
              {authMsg && <div className="mt-3 text-sm text-red-600">{authMsg}</div>}
            </div>
          </div>
        )}

        {/* Address modal */}
        {addressModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white p-4 rounded w-[480px]">
              <h3 className="font-semibold mb-2">Delivery Address (required)</h3>
              <div className="mb-2 text-sm text-gray-600">Please enter the full delivery address before placing the order.</div>
              <textarea value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full p-2 border rounded h-28" />
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => { setAddressModalOpen(false); setAddressMsg(""); }} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
                <button onClick={saveAddressAndClose} className="px-3 py-1 bg-blue-600 text-white rounded">Save Address</button>
              </div>
              {addressMsg && <div className="mt-2 text-sm text-red-600">{addressMsg}</div>}
            </div>
          </div>
        )}

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

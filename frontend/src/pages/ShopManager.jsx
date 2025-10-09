// frontend/src/pages/ShopManager.jsx
import React, { useEffect, useState } from "react";
import { getApiBase } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";

import Cart from "../components/Cart";
import ProfileMenu from "../components/ProfileMenu";

const API_BASE = getApiBase();
const API_KEY = import.meta.env.VITE_API_KEY || "";

export default function ShopManager() {
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(false);

  // customer info (simple)
  const [customerName, setCustomerName] = useState(localStorage.getItem("customer_name") || "");
  // store only 10-digit numeric string here (we show +91 in UI)
  const [customerPhone, setCustomerPhone] = useState(localStorage.getItem("customer_phone") || "");
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
  const [otpPhone, setOtpPhone] = useState("");
  const [otpDigitsInput, setOtpDigitsInput] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  // addresses: each object: { name, phone (10 digits), address, pincode, default: boolean }
  const [addresses, setAddresses] = useState(() => {
    try {
      const a = JSON.parse(localStorage.getItem("customer_addresses") || "[]");
      // ensure at least first is default if present
      if (Array.isArray(a) && a.length > 0 && !a.find(x => x.default)) {
        a[0].default = true;
      }
      return a;
    } catch {
      return [];
    }
  });
  const [addressMsg, setAddressMsg] = useState("");


  const [cartModalOpen, setCartModalOpen] = useState(false);

  // load shops on mount
  useEffect(() => {
    loadShops();
    setCustomerToken(localStorage.getItem("customer_token") || "");
    setCustomerName(localStorage.getItem("customer_name") || "");
    setCustomerPhone(localStorage.getItem("customer_phone") || "");
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
      if (pincode && pincode.trim()) url += `?pincode=${encodeURIComponent(pincode.trim())}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load shops");
      const data = await res.json();
      setShops(data);
      if (data.length) {
        // keep selected shop if present, else first
        const found = selectedShop && data.find((s) => s._id === selectedShop._id) ? data.find((s) => s._id === selectedShop._id) : data[0];
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
    setCart((prev) => {
      const copy = { ...prev };
      if (!qty || qty <= 0) delete copy[itemId];
      else copy[itemId] = Number(qty);
      return copy;
    });
  }

  function increment(itemId) {
    setQty(itemId, getQty(itemId) + 1);
  }

  function decrement(itemId) {
    setQty(itemId, Math.max(0, getQty(itemId) - 1));
  }

  function addInitial(itemId) {
    setQty(itemId, 1);
  }

  function cartItemsArray() {
    return Object.keys(cart).map((id) => {
      const qty = cart[id];
      const item = menu.find((m) => String(m._id) === String(id));
      return { _id: id, qty, name: item ? item.name : "Item", price: item ? Number(item.price || 0) : 0 };
    });
  }

  function cartSummary() {
    const items = cartItemsArray();
    const totalQty = items.reduce((s, i) => s + i.qty, 0);
    const totalPrice = items.reduce((s, i) => s + i.qty * i.price, 0);
    return { items, totalQty, totalPrice };
  }

  // Validate 6-digit pincode
  function validatePincode(pin) {
    if (!pin) return true;
    return /^\d{6}$/.test(pin.trim());
  }

  function setAndApplyPincode(pin) {
    setPincode(pin);
    localStorage.setItem("customer_pincode", pin || "");
  }

  // phone blur (we keep digits only)
  function handlePhoneBlur() {
    const digits = (customerPhone || "").replace(/\D/g, "");
    if (digits.length === 10) setCustomerPhone(digits.slice(-10));
  }

  // ---- Auth (OTP) helpers ----
  async function sendOtpToPhone(digits10, nameToSave) {
    setAuthMsg("");
    try {
      const digits = String(digits10 || "").replace(/\D/g, "").slice(-10);
      if (digits.length !== 10) {
        setAuthMsg("Enter 10 digits to send OTP");
        return;
      }
      if (!nameToSave || !String(nameToSave).trim()) {
        setAuthMsg("Please enter your name before requesting OTP");
        return;
      }

      const normalized = `+91${digits}`;
      // call backend to send OTP
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
      // temporarily keep the provided name so verify can use it
      setCustomerName(nameToSave || "");
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

      // Save token and canonical customer info
      localStorage.setItem("customer_token", data.token);
      setCustomerToken(data.token);

      // Save phone digits
      const digits = (otpPhone || "").replace(/\D/g, "").slice(-10);
      localStorage.setItem("customer_phone", digits);
      setCustomerPhone(digits);

      // Save name as well — customerName may have been set earlier via sendOtpToPhone
      const nameCandidate = (customerName || "").trim();
      if (nameCandidate) {
        localStorage.setItem("customer_name", nameCandidate);
        setCustomerName(nameCandidate);
      } else {
        // fallback to phone if no name provided (shouldn't happen because we validated)
        localStorage.setItem("customer_name", `+91${digits}`);
        setCustomerName(`+91${digits}`);
      }

      // Clear auth UI
      setAuthModalOpen(false);
      setOtpSent(false);
      setOtpCode("");
      setAuthMsg("Logged in");
    } catch (e) {
      console.error("verifyOtp error", e);
      setAuthMsg("Verify failed: " + (e.message || e));
    }
  }

  function logoutCustomer() {
    localStorage.removeItem("customer_token");
    localStorage.removeItem("customer_name");
    localStorage.removeItem("customer_phone");
    setCustomerToken("");
    setCustomerName("");
    setCustomerPhone("");
  }

    // ---------- Address helpers (parent-managed, used by Cart modal) ----------
  function persistAddresses(arr) {
    // ensure default exists
    const copy = Array.isArray(arr) ? arr.slice() : [];
    if (copy.length > 0 && !copy.find(x => x.default)) {
      copy[0].default = true;
    }
    setAddresses(copy);
    localStorage.setItem("customer_addresses", JSON.stringify(copy));
  }

  function saveAddressesToStore(arr) {
    persistAddresses(arr);
  }

  // Add or update an address: if editIndex is null -> add, else update index
  function addOrUpdateAddressFromCart(form, editIndex = null) {
    // validate
    if (!form || !form.name || String(form.name).trim().length < 2) throw new Error("Name required");
    if (!/^\d{10}$/.test(String(form.phone || "").replace(/\D/g, ""))) throw new Error("Phone must be 10 digits");
    if (!form.address || String(form.address).trim().length < 5) throw new Error("Address required");
    if (!/^\d{6}$/.test(String(form.pincode || "").trim())) throw new Error("Pincode must be 6 digits");

    const copy = addresses.slice();
    if (typeof editIndex === "number" && editIndex >= 0 && editIndex < copy.length) {
      copy[editIndex] = { ...form, phone: String(form.phone).replace(/\D/g, "").slice(-10), default: !!copy[editIndex].default };
    } else {
      // new address: make default if this is first address
      const isDefault = copy.length === 0;
      copy.push({ ...form, phone: String(form.phone).replace(/\D/g, "").slice(-10), default: !!isDefault });
    }
    persistAddresses(copy);
    return copy;
  }

  // Delete address (parent enforces default rules)
  function deleteAddressFromCart(idx) {
    if (idx < 0 || idx >= addresses.length) throw new Error("invalid index");
    // if the address is default and it's the only one -> don't allow
    if (addresses[idx].default && addresses.length === 1) {
      throw new Error("Default address cannot be deleted. Add another address and set it default first.");
    }
    const copy = addresses.slice();
    copy.splice(idx, 1);
    // if removed default, ensure some default exists
    if (!copy.find(x => x.default) && copy.length > 0) copy[0].default = true;
    persistAddresses(copy);
    return copy;
  }

  // Set default address index
  function setDefaultAddress(idx) {
    if (idx < 0 || idx >= addresses.length) throw new Error("invalid index");
    const copy = addresses.map((a, i) => ({ ...a, default: i === idx }));
    persistAddresses(copy);
    return copy;
  }


  // Final place order called from Cart -> confirm
  async function placeOrderFinal(selectedAddress) {
    // make sure logged in
    if (!customerToken) {
      setAuthModalOpen(true);
      return { ok: false, message: "Login required" };
    }
    if (!selectedShop) return { ok: false, message: "Select a shop" };
    const { items, totalPrice } = cartSummary();
    if (!items.length) return { ok: false, message: "Cart empty" };

    // check pincode matches shop
    if (selectedAddress.pincode && selectedShop.pincode && String(selectedAddress.pincode) !== String(selectedShop.pincode)) {
      return { ok: false, message: `Shop does not serve pincode ${selectedAddress.pincode}. Shop pincode: ${selectedShop.pincode}` };
    }

    // build payload
    const payload = {
      shop: selectedShop._id,
      customerName: selectedAddress.name,
      phone: `+91${(selectedAddress.phone || "").replace(/\D/g, "").slice(-10)}`,
      address: selectedAddress.address,
      items: items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
    };
    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Order failed");
      }
      const order = await res.json();
      setCart({});
      return { ok: true, order };
    } catch (e) {
      console.error("placeOrder error", e);
      return { ok: false, message: e.message || String(e) };
    }
  }

  // Top-right badge
  function TopRightBadge() {
    if (customerToken) {
      const displayName = customerName && customerName.trim() ? customerName : `+91${(customerPhone || "").slice(-10)}`;
      return (
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-700">Logged in as <b>{displayName}</b></div>
          <button onClick={() => navigate("/profile")} className="px-2 py-1 bg-gray-100 border rounded text-sm">Profile</button>
          <button onClick={logoutCustomer} className="px-2 py-1 bg-red-500 text-white rounded text-sm">Logout</button>
        </div>
      );
    }
    return <button onClick={() => setAuthModalOpen(true)} className="px-3 py-1 bg-blue-600 text-white rounded">Login</button>;
  }

  // Render
  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded shadow">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-semibold">Shops & Menu</h1>
          <TopRightBadge />
        </div>

        {/* top inputs */}
        <div className="mb-4 p-4 border rounded bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                localStorage.setItem("customer_name", e.target.value || "");
              }}
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
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setCustomerPhone(digits);
                    localStorage.setItem("customer_phone", digits || "");
                    setInlinePhoneError("");
                  }}
                  onBlur={handlePhoneBlur}
                  placeholder="Enter 10-digit number"
                  className="p-2 flex-1 outline-none"
                />
              </div>
              {inlinePhoneError ? <div className="text-sm text-red-600 mt-1">{inlinePhoneError}</div> : null}
              {customerToken ? <div className="text-xs text-green-700 mt-1">Logged in</div> : <div className="text-xs text-gray-600 mt-1">You will be asked to login before placing order</div>}
            </div>

            <div>
              <input
                value={pincode}
                onChange={(e) => { setPincode(e.target.value.replace(/\D/g, '').slice(0,6)); setPincodeErr("") }}
                placeholder="Filter by pincode (6 digits)"
                className="p-2 border rounded w-full"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={() => { if (!validatePincode(pincode)) { setPincodeErr("Enter 6 digits"); return } setAndApplyPincode(pincode); loadShops(); }} className="px-3 py-1 bg-blue-600 text-white rounded">Apply</button>
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
                  <div className="text-sm text-gray-600 mb-2">Enter your name and phone to receive OTP</div>

                  <div className="mb-2">
                    <label className="text-sm block mb-1">Name</label>
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Your full name"
                      className="p-2 border rounded w-full"
                    />
                  </div>

                  <div className="flex gap-2 items-center mb-3">
                    <span className="px-3 py-2 bg-gray-100 select-none">+91</span>
                    <input
                      value={otpDigitsInput || customerPhone}
                      onChange={(e) => setOtpDigitsInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="10-digit phone"
                      className="p-2 border rounded flex-1"
                    />
                  </div>

                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => { setAuthModalOpen(false); setAuthMsg(""); setOtpDigitsInput(""); }} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
                    <button onClick={() => sendOtpToPhone(otpDigitsInput || customerPhone, customerName)} className="px-3 py-1 bg-blue-600 text-white rounded">Send OTP</button>
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



        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1">
            <h3 className="font-medium mb-2">Available Shops</h3>

            {loading ? <div>Loading...</div> : shops.length === 0 ? <div>No shops</div> :
              shops.map(s => (
                <div key={s._id} className={`p-3 mb-3 border rounded cursor-pointer ${selectedShop && selectedShop._id === s._id ? "bg-blue-50" : ""}`} onClick={() => setSelectedShop(s)}>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.phone} • {s.pincode || "—"}</div>
                  {s.description ? <div className="text-xs text-gray-400">{s.description}</div> : null}
                </div>
              ))
            }
            <div className="mt-3">
              <button onClick={() => openAddAddressModal()} className="px-3 py-1 bg-gray-200 rounded">Add Delivery Address</button>
            </div>
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
                      {/* Add to Cart controls */}
                      {!item.available ? (
                        <button className="px-3 py-1 bg-gray-300 rounded" disabled>Unavailable</button>
                      ) : getQty(item._id) <= 0 ? (
                        <button onClick={() => addInitial(item._id)} className="px-3 py-1 bg-green-600 text-white rounded">Add</button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => decrement(item._id)} className="px-2 py-1 bg-gray-200 rounded">−</button>
                          <div className="px-3 py-1 border rounded">{getQty(item._id)}</div>
                          <button onClick={() => increment(item._id)} className="px-2 py-1 bg-gray-200 rounded">+</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Cart component (right column) */}
          <div className="mt-4">
  <Cart
    items={cartItemsArray()}
    totalQty={totalQty}
    totalPrice={totalPrice}
    onIncrement={(id) => increment(id)}
    onDecrement={(id) => decrement(id)}
    onRemove={(id) => setQty(id, 0)}
    onPlaceOrder={() => setCartModalOpen(true)}
    disabled={selectedShop ? !selectedShop.online : true}
  />
</div>

          </div>
        </div>
      </div>

      {/* Cart modal */}
{cartModalOpen && (
  <Cart
    modal={true}
    items={cartSummary().items}
    total={cartSummary().totalPrice}
    onIncrement={(id) => increment(id)}
    onDecrement={(id) => decrement(id)}
    onRemove={(id) => setQty(id, 0)}
    addresses={addresses}
    onAddOrUpdateAddress={async (addr, editIndex) => {
      try {
        const updated = addOrUpdateAddressFromCart(addr, typeof editIndex === "number" ? editIndex : null);
        return updated;
      } catch (e) {
        throw e;
      }
    }}
    onDeleteAddress={async (idx) => {
      try {
        const updated = deleteAddressFromCart(idx);
        return updated;
      } catch (e) {
        throw e;
      }
    }}
    onSetDefault={async (idx) => {
      try {
        const updated = setDefaultAddress(idx);
        return updated;
      } catch (e) {
        throw e;
      }
    }}
    onConfirm={async (addressIdx) => {
      // call the parent placeOrderFinal which already verifies pincode and auth
      if (addressIdx < 0 || addressIdx >= addresses.length) {
        return { ok: false, message: "Select an address" };
      }
      const addr = addresses[addressIdx];
      const res = await placeOrderFinal(addr);
      return res;
    }}
    onClose={() => setCartModalOpen(false)}
  />
)}

    </div>
  );
}

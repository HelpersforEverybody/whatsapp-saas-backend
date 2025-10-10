// frontend/src/pages/ShopManager.jsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getApiBase } from "../hooks/useApi";
import Cart from "../components/Cart";
import ProfileMenu from "../components/ProfileMenu";
import OrderHistory from "../components/OrderHistory";
import { Home, Briefcase, MapPin } from "lucide-react"; // icons used for address labels

const API_BASE = getApiBase();
const API_KEY = import.meta.env.VITE_API_KEY || "";

export default function ShopManager() {
  // shops & menu
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);


  // filter pincode
  const [pincode, setPincode] = useState("");
  const [pincodeErr, setPincodeErr] = useState("");

  // cart map itemId -> qty
  const [cart, setCart] = useState({});

  // auth / customer info
  const [customerToken, setCustomerToken] = useState(localStorage.getItem("customer_token") || "");
  const [customerName, setCustomerName] = useState(localStorage.getItem("customer_name") || "");
  const [customerPhone, setCustomerPhone] = useState(localStorage.getItem("customer_phone") || "");
  const [inlinePhoneError, setInlinePhoneError] = useState("");

  // Auth modal / OTP
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [otpSent, setOtpSent] = useState(false);
  const [otpPhone, setOtpPhone] = useState("");
  const [otpDigitsInput, setOtpDigitsInput] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  // address modal (portal)
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressEditIndex, setAddressEditIndex] = useState(null);
  const [addresses, setAddresses] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("customer_addresses") || "[]");
    } catch {
      return [];
    }
  });
  const [addressForm, setAddressForm] = useState({ label: "Home", name: "", phone: "", address: "", pincode: "" });
  const [addressMsg, setAddressMsg] = useState("");

  // cart modal
  const [cartModalOpen, setCartModalOpen] = useState(false);

  // mount
  useEffect(() => {
    loadShops();
    setCustomerToken(localStorage.getItem("customer_token") || "");
    setCustomerName(localStorage.getItem("customer_name") || "");
    setCustomerPhone(localStorage.getItem("customer_phone") || "");
    if (localStorage.getItem("customer_token")) {
      fetchCustomerAddresses().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // -------------------------
  // Data loading
  // -------------------------
  async function loadShops() {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/shops`;
      if (pincode && pincode.trim()) url += `?pincode=${encodeURIComponent(String(pincode).trim())}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load shops");
      const data = await res.json();
      setShops(data || []);
      if (data && data.length) {
        const found = selectedShop && data.find(s => s._id === selectedShop._id) ? data.find(s => s._id === selectedShop._id) : data[0];
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
      setMenu(data || []);
    } catch (e) {
      console.error("Load menu error", e);
      alert("Failed to load menu");
    }
  }

  // -------------------------
  // Cart helpers
  // -------------------------
  function getQty(itemId) { return Number(cart[itemId] || 0); }
  function setQty(itemId, qty) {
    setCart(prev => {
      const copy = { ...prev };
      if (!qty || qty <= 0) delete copy[itemId];
      else copy[itemId] = Number(qty);
      return copy;
    });
  }
  function increment(itemId) { setQty(itemId, getQty(itemId) + 1); }
  function decrement(itemId) { setQty(itemId, Math.max(0, getQty(itemId) - 1)); }
  function addInitial(itemId) { setQty(itemId, 1); }

  function cartItemsArray() {
    return Object.keys(cart).map(id => {
      const qty = cart[id];
      const item = menu.find(m => String(m._id) === String(id));
      return { _id: id, qty, name: item ? item.name : "Item", price: item ? Number(item.price || 0) : 0 };
    });
  }
  function cartSummary() {
    const items = cartItemsArray();
    const totalQty = items.reduce((s, i) => s + i.qty, 0);
    const totalPrice = items.reduce((s, i) => s + i.qty * i.price, 0);
    return { totalQty, totalPrice, items };
  }
  function handleReorder(order) {
  // attempt to update prices from selectedShop/menu if order.shop matches current selected
  // fallback: directly restore old order prices into cart.
  const newCart = {};
  (order.items || []).forEach(it => {
    // keying by itemId if present, else by name
    const key = it.itemId || it._id || it.name;
    newCart[key] = (newCart[key] || 0) + (it.qty || 1);
  });
  setCart(newCart);
  setOrderHistoryOpen(false);
  setCartModalOpen(true);
}


  // -------------------------
  // Validation helpers
  // -------------------------
  function validatePincode(pin) {
    if (!pin) return true;
    return /^\d{6}$/.test(String(pin).trim());
  }
  function setAndApplyPincode(pin) {
    setPincode(pin);
    localStorage.setItem("customer_pincode", pin || "");
  }
  function handlePhoneInputDigits(v, setter = setCustomerPhone) {
    const digits = String(v || "").replace(/\D/g, "").slice(0, 10);
    setter(digits);
  }

  // -------------------------
  // Auth (OTP) helpers
  // -------------------------
  async function sendOtpToPhone(digits10, nameToKeepIfSignup) {
    setAuthMsg("");
    try {
      const digits = String(digits10 || "").replace(/\D/g, "").slice(-10);
      if (digits.length !== 10) { setAuthMsg("Enter 10 digits to send OTP"); return; }
      if (authMode === "signup" && (!nameToKeepIfSignup || !String(nameToKeepIfSignup).trim())) { setAuthMsg("Please enter your name to signup"); return; }
      const normalized = `+91${digits}`;
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });
      if (!res.ok) {
        const txt = await res.text(); throw new Error(txt || "Failed to send OTP");
      }
      setOtpSent(true);
      setOtpPhone(normalized);
      setOtpDigitsInput(digits);
      setAuthMsg("OTP sent — check server logs (demo).");
      if (authMode === "signup" && nameToKeepIfSignup) setCustomerName(nameToKeepIfSignup);
    } catch (e) {
      console.error("sendOtp error", e);
      setAuthMsg("Error sending OTP: " + (e.message || e));
    }
  }

  // verify OTP (+ signup flow handled server-side)
  async function verifyOtpAndLogin() {
    setAuthMsg("");
    try {
      if (!otpPhone || !otpCode) { setAuthMsg("Phone and OTP required"); return; }
      const payload = { phone: otpPhone, otp: otpCode };
      if (authMode === "signup") {
        payload.name = customerName || "";
        payload.signup = true;
      }
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text(); throw new Error(txt || "OTP verify failed");
      }
      const data = await res.json();
      if (!data.token) throw new Error("No token returned");
      localStorage.setItem("customer_token", data.token);
      localStorage.setItem("customer_phone", (data.phone || "").replace(/\D/g, "").slice(-10) || otpDigitsInput || "");
      localStorage.setItem("customer_name", (data.name || customerName || "").trim() || "");
      setCustomerToken(data.token);
      setCustomerPhone((data.phone || "").replace(/\D/g, "").slice(-10) || "");
      setCustomerName((data.name || customerName || "").trim() || "");
      await fetchCustomerAddresses();
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

  // -------------------------
  // Addresses (server-aware)
  // -------------------------
  async function fetchCustomerAddresses() {
    try {
      const token = localStorage.getItem("customer_token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/customers/addresses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load addresses");
      const data = await res.json();
      setAddresses(Array.isArray(data) ? data : []);
      localStorage.setItem("customer_addresses", JSON.stringify(Array.isArray(data) ? data : []));
    } catch (e) {
      console.error("fetchCustomerAddresses error", e);
    }
  }

  function saveAddressesToStore(arr) {
    setAddresses(arr);
    localStorage.setItem("customer_addresses", JSON.stringify(arr));
  }

  function validateAddressForm(form) {
    if (!form.name || form.name.trim().length < 2) return "Name required";
    const digits = (form.phone || "").replace(/\D/g, "");
    if (digits.length !== 10) return "Phone must be 10 digits";
    if (!form.address || form.address.trim().length < 5) return "Address required";
    if (!/^\d{6}$/.test(String(form.pincode || "").trim())) return "Pincode must be 6 digits";
    return null;
  }

  function openAddAddressModal(editIndex = null, opts = {}) {
  const prefill = opts.prefill !== undefined ? Boolean(opts.prefill) : true;

  if (typeof editIndex === "number") {
    const existing = addresses[editIndex] || {};
    const rawPhone = String(existing.phone || "");
    const digits = rawPhone.replace(/\D/g, "").slice(-10);
    setAddressForm({
      label: existing.label || "Home",
      name: existing.name || "",
      phone: digits || "",
      address: existing.address || "",
      pincode: existing.pincode || (selectedShop ? selectedShop.pincode : ""),
    });
    setAddressEditIndex(editIndex);
  } else {
    // For "Add new" path — allow caller to choose whether to prefill
    setAddressForm({
      label: "Home",
      name: prefill ? (customerName || "") : "",
      phone: prefill ? ((customerPhone || "").replace(/\D/g, "").slice(-10)) : "",
      address: "",
      pincode: selectedShop?.pincode || "",
    });
    setAddressEditIndex(null);
  }
  setAddressMsg("");
  setAddressModalOpen(true);
}


  // add or update (server if logged-in)
  async function addOrUpdateAddress(editIndex = null) {
    const err = validateAddressForm(addressForm);
    if (err) { setAddressMsg(err); return; }
    const token = localStorage.getItem("customer_token");
    if (token) {
      try {
        const body = {
          label: addressForm.label,
          name: addressForm.name,
          phone: (addressForm.phone || "").replace(/\D/g, "").length === 10 ? `+91${(addressForm.phone || "").replace(/\D/g, "").slice(-10)}` : (addressForm.phone || ""),
          address: addressForm.address,
          pincode: addressForm.pincode
        };
        if (typeof editIndex === "number" && addresses[editIndex] && addresses[editIndex]._id) {
          const id = addresses[editIndex]._id;
          const res = await fetch(`${API_BASE}/api/customers/addresses/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body)
          });
          if (!res.ok) { const txt = await res.text(); throw new Error(txt || "Failed to update address"); }
          await fetchCustomerAddresses();
        } else {
          const res = await fetch(`${API_BASE}/api/customers/addresses`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body)
          });
          if (!res.ok) { const txt = await res.text(); throw new Error(txt || "Failed to add address"); }
          await fetchCustomerAddresses();
        }
        setAddressModalOpen(false);
        setAddressMsg("");
        setAddressEditIndex(null);
      } catch (e) {
        console.error("addOrUpdateAddress error", e);
        setAddressMsg("Save failed: " + (e.message || e));
      }
      return;
    }
    // guest fallback
    const copy = [...addresses];
    const localAddr = {
      _id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
      label: addressForm.label,
      name: addressForm.name,
      phone: (addressForm.phone || "").replace(/\D/g, "").slice(-10),
      address: addressForm.address,
      pincode: addressForm.pincode,
    };
    if (typeof editIndex === "number") copy[editIndex] = localAddr;
    else copy.push(localAddr);
    saveAddressesToStore(copy);
    setAddressModalOpen(false);
    setAddressEditIndex(null);
  }

  async function deleteAddress(idx) {
    const token = localStorage.getItem("customer_token");
    if (token && addresses[idx] && addresses[idx]._id) {
      try {
        if (idx === 0 && addresses.length > 1) {
          const proceed = window.confirm("This is your first address (default). Make another address default before deleting. Set another default now?");
          if (!proceed) return;
        }
        const id = addresses[idx]._id;
        const res = await fetch(`${API_BASE}/api/customers/addresses/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) { const txt = await res.text(); throw new Error(txt || "Delete failed"); }
        await fetchCustomerAddresses();
        return;
      } catch (e) {
        console.error("deleteAddress error", e);
        alert("Delete failed: " + (e.message || e));
        return;
      }
    }
    const copy = [...addresses];
    copy.splice(idx, 1);
    saveAddressesToStore(copy);
  }

  // -------------------------
  // Place order final
  // -------------------------
  async function placeOrderFinal(selectedAddress) {
    if (!customerToken) { setAuthModalOpen(true); return { ok: false, message: "Login required" }; }
    if (!selectedShop) return { ok: false, message: "Select a shop" };
    const { items, totalPrice } = cartSummary();
    if (!items.length) return { ok: false, message: "Cart empty" };

    if (selectedAddress.pincode && selectedShop.pincode && String(selectedAddress.pincode) !== String(selectedShop.pincode)) {
      return { ok: false, message: `Shop does not serve pincode ${selectedAddress.pincode}. Shop pincode: ${selectedShop.pincode}` };
    }

    const payload = {
      shop: selectedShop._id,
      customerName: selectedAddress.name,
      phone: `+91${(selectedAddress.phone || "").replace(/\D/g, "").slice(-10)}`,
      address: {
        label: selectedAddress.label || "",
        address: selectedAddress.address,
        phone: selectedAddress.phone || "",
        pincode: selectedAddress.pincode || ""
      },
      items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
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
      if (!res.ok) { const txt = await res.text(); throw new Error(txt || "Order failed"); }
      const order = await res.json();
      setCart({});
      return { ok: true, order };
    } catch (e) {
      console.error("placeOrder error", e);
      return { ok: false, message: e.message || String(e) };
    }
  }

  function TopRightBadge() {
  // keep My Orders visible regardless of login state OR only for logged-in
  // in this example we'll show it only when logged in
  if (customerToken) {
    const displayName = (customerName && customerName.trim()) ? customerName : `+91${(customerPhone || "").slice(-10)}`;
    return (
      <div className="flex items-center gap-3">
        {/* My Orders button */}
        <button
          onClick={() => setOrderHistoryOpen(true)}
          className="px-3 py-1 bg-gray-100 rounded text-sm"
        >
          My Orders
        </button>

        {/* Profile menu */}
        <ProfileMenu
          name={displayName}
          phone={`+91${(customerPhone || "").slice(-10)}`}
          onLogout={logoutCustomer}
          addresses={addresses}
          onOpenAddressModal={() => openAddAddressModal(null)}
          onManageAddresses={() => setCartModalOpen(true)}
        />
      </div>
    );
  }

  // not logged in
  return (
    <div>
      <button
        onClick={() => { setAuthMode("login"); setAuthModalOpen(true); }}
        className="px-3 py-1 bg-blue-600 text-white rounded"
      >
        Login / Signup
      </button>
    </div>
  );
}


  // -------------------------
  // Render
  // -------------------------
  const { totalQty, totalPrice } = cartSummary();

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded shadow">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-semibold">Shops & Menu</h1>
          <TopRightBadge />
        </div>

        {/* top area */}
        <div className="mb-4 p-4 border rounded bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <div className="text-sm text-gray-600"> (You must login before placing an order)</div>
            </div>

            <div>
              <div className="text-sm text-gray-600 mb-1">Phone (used after login)</div>
              <div className="flex items-center border rounded overflow-hidden">
                <span className="px-3 py-2 bg-gray-100 text-gray-700 select-none">+91</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="10"
                  value={customerPhone}
                  onChange={(e) => handlePhoneInputDigits(e.target.value, setCustomerPhone)}
                  placeholder="Enter 10-digit number (optional)"
                  className="p-2 flex-1 outline-none"
                />
              </div>
            </div>

            <div>
              <input
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0,6))}
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

            {/* Inline Cart summary + button to open full cart modal */}
            <div className="mt-4 border rounded p-3 bg-white">
              <div className="flex justify-between">
                <div>
                  <div className="text-sm text-gray-600">Cart: <b>{totalQty}</b> items</div>
                  <div className="text-sm text-gray-800">Total: <b>₹{totalPrice}</b></div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (localStorage.getItem('customer_token')) {
                        await fetchCustomerAddresses().catch(err => console.error('addr fetch before cart open failed', err));
                      }
                      setCartModalOpen(true);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded"
                  >
                    Open Cart
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Auth modal (Login / Signup w/ OTP) */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white p-4 rounded w-[420px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{authMode === "login" ? "Login (phone only)" : "Signup (name + phone)"}</h3>
              <div className="flex gap-2">
                <button onClick={() => { setAuthMode("login"); setOtpSent(false); setAuthMsg(""); }} className={`px-2 py-1 rounded ${authMode === "login" ? "bg-gray-200" : "bg-white"}`}>Login</button>
                <button onClick={() => { setAuthMode("signup"); setOtpSent(false); setAuthMsg(""); }} className={`px-2 py-1 rounded ${authMode === "signup" ? "bg-gray-200" : "bg-white"}`}>Signup</button>
              </div>
            </div>

            {!otpSent ? (
              <>
                {authMode === "signup" && (
                  <div className="mb-2">
                    <label className="text-sm block mb-1">Name</label>
                    <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="p-2 border rounded w-full" placeholder="Your full name" />
                  </div>
                )}

                <div className="mb-2">
                  <label className="text-sm block mb-1">Phone</label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 bg-gray-100 select-none">+91</span>
                    <input value={otpDigitsInput || customerPhone} onChange={e => handlePhoneInputDigits(e.target.value, setOtpDigitsInput)} placeholder="10-digit phone" className="p-2 border rounded flex-1" />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={() => { setAuthModalOpen(false); setOtpSent(false); setOtpDigitsInput(""); setAuthMsg(""); }} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
                  <button onClick={() => sendOtpToPhone(otpDigitsInput || customerPhone, customerName)} className="px-3 py-1 bg-blue-600 text-white rounded">Send OTP</button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-2 text-sm">Enter OTP sent to {otpPhone}</div>
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

      {/* Cart modal (confirm & place order) */}
      {cartModalOpen && (
        <Cart
          items={cartSummary().items}
          totalQty={cartSummary().totalQty}
          totalPrice={cartSummary().totalPrice}
          addresses={addresses}
          onAddAddress={() => openAddAddressModal(null, { prefill: false })}
          onEditAddress={(idx) => openAddAddressModal(idx)}
          onDeleteAddress={(idx) => { if (!window.confirm("Delete this address?")) return; deleteAddress(idx); }}
          onSetDefault={async (addrId) => {
            try {
              const token = localStorage.getItem("customer_token");
              if (!token) throw new Error("Not logged in");
              const res = await fetch(`${API_BASE}/api/customers/addresses/${addrId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ isDefault: true })
              });
              if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || "Failed to set default");
              }
              await fetchCustomerAddresses();
            } catch (e) {
              console.error("setDefaultAddress error", e);
              alert("Set default failed: " + (e.message || e));
            }
          }}
          onClose={() => setCartModalOpen(false)}
          onConfirm={async (addressIdx) => {
            const chosen = addresses[addressIdx];
            if (!chosen) { alert("Select or add address first"); return; }
            const result = await placeOrderFinal(chosen);
            if (result.ok) {
              alert("Order placed successfully");
              setCartModalOpen(false);
            } else {
              alert("Order failed: " + (result.message || "unknown"));
            }
          }}
        />
      )}

     {/* Address Add/Edit portal modal: if the cart portal exists mount inside it (absolute),
    otherwise fallback to document.body (fixed). */}
{addressModalOpen && (() => {
  const portalTarget = (typeof document !== "undefined") ? document.getElementById("cart-address-portal") : null;
  const isInCart = !!portalTarget;

  // overlay and modal z-indexes must be above the cart manage panel z
 const overlayClass = isInCart
  ? "fixed inset-0 z-[10040] flex items-center justify-center"
  : "fixed inset-0 z-50 flex items-end justify-center";

  const backdropClass = "absolute inset-0 bg-black/40";

  // ensure the modal itself has a higher z-index than the overlay
  const modal = (
    <div className={overlayClass} onClick={() => { setAddressModalOpen(false); setAddressEditIndex(null); }}>
      <div className={backdropClass} />
      <div
        className="relative bg-white rounded-t-2xl w-full max-w-[520px] p-5 shadow-lg pointer-events-auto z-[10050]"
        onClick={(e) => e.stopPropagation()}
        style={{ transform: "none", position: isInCart ? "relative" : "static" }}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">{typeof addressEditIndex === "number" ? "Edit Address" : "Add New Address"}</h3>
          <button onClick={() => { setAddressModalOpen(false); setAddressMsg(""); setAddressEditIndex(null); }} className="text-gray-600">✕</button>
        </div>

        <div className="flex gap-2 mb-3">
          {["Home","Office","Other"].map(t => (
            <button
              key={t}
              onClick={() => setAddressForm(f => ({ ...f, label: t }))}
              className={`flex items-center gap-1 px-3 py-1 border rounded-full text-sm ${addressForm.label === t ? "bg-blue-100 border-blue-400" : "border-gray-200"}`}
            >
              {t === "Home" && <Home size={14} />}
              {t === "Office" && <Briefcase size={14} />}
              {t === "Other" && <MapPin size={14} />}
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <input placeholder="Receiver’s name *" value={addressForm.name} onChange={(e) => setAddressForm(f => ({ ...f, name: e.target.value }))} className="border rounded w-full p-2" />

          <div className="flex items-center border rounded overflow-hidden">
            <span className="px-3 py-2 bg-gray-100 select-none">+91</span>
            <input
              placeholder="Phone (10 digits)*"
              value={addressForm.phone}
              onChange={(e) => setAddressForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0,10) }))}
              className="p-2 flex-1 outline-none"
              maxLength={10}
            />
          </div>

          <textarea placeholder="Complete address *" value={addressForm.address} onChange={(e) => setAddressForm(f => ({ ...f, address: e.target.value }))} className="border rounded w-full p-2 h-24" />

          <input placeholder="Pincode *" value={addressForm.pincode} onChange={(e) => setAddressForm(f => ({ ...f, pincode: e.target.value.replace(/\D/g, "").slice(0,6) }))} className="border rounded w-full p-2" maxLength={6} />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => { setAddressModalOpen(false); setAddressMsg(""); setAddressEditIndex(null); }} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
          <button onClick={() => addOrUpdateAddress(addressEditIndex)} className="px-4 py-1 bg-blue-600 text-white rounded">Save Address</button>
        </div>

        {addressMsg && <div className="mt-3 text-sm text-red-600">{addressMsg}</div>}
      </div>
    </div>
  );

  return createPortal(modal, document.body);

})()}
<OrderHistory
  open={orderHistoryOpen}
  onClose={() => setOrderHistoryOpen(false)}
  apiBase={API_BASE}
  authToken={customerToken}
  onReorder={(order) => {
    // Example reorder behavior: replace cart with order items
    const newCart = {};
    (order.items || []).forEach(it => {
      // attempt to match shop menu items by name/id if you store ids
      // For now we insert synthetic ids using name to keep it simple:
      const id = it._id || it.id || it.name;
      newCart[id] = (newCart[id] || 0) + Number(it.qty || 1);
    });
    setCart(newCart);
    setOrderHistoryOpen(false);
    // open cart for user to review
    setCartModalOpen(true);
  }}
/>
    </div>
  );
}


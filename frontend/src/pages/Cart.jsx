// frontend/src/pages/Cart.jsx
import React, { useEffect, useState } from "react";
import { getApiBase, apiFetch, getCustomerToken } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";

const API_BASE = getApiBase();
const CART_KEY = "zynk_cart_v1";

export default function Cart() {
  const navigate = useNavigate();
  const [cartMeta, setCartMeta] = useState({ selectedShop: null, items: {} });
  const [menuItems, setMenuItems] = useState([]); // list of item objects loaded for display (fetched from shop menu)
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "", address: "", pincode: "", phone: "" });
  const [addrMsg, setAddrMsg] = useState("");
  const [placing, setPlacing] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setCartMeta({ selectedShop: parsed.selectedShop || null, items: parsed.items || {} });
        if (parsed.selectedShop && parsed.selectedShop._id) loadMenu(parsed.selectedShop._id);
      } catch (e) {}
    } else {
      setMsg("No cart found. Add items first.");
    }
    // load addresses if logged in
    if (getCustomerToken()) {
      loadAddresses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMenu(shopId) {
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      setMenuItems(data || []);
    } catch (e) {
      console.error("load menu", e);
    }
  }

  // addresses
  async function loadAddresses() {
    try {
      const res = await apiFetch("/api/customers/addresses");
      if (!res.ok) throw new Error("failed to load addresses");
      const data = await res.json();
      setAddresses(data || []);
    } catch (e) {
      console.error("loadAddresses", e);
    }
  }

  function cartArray() {
    return Object.keys(cartMeta.items).map(id => {
      const qty = cartMeta.items[id];
      const item = menuItems.find(m => String(m._id) === String(id));
      return { _id: id, qty, name: item ? item.name : "Item", price: item ? Number(item.price || 0) : 0 };
    });
  }

  function cartSummary() {
    const items = cartArray();
    const totalQty = items.reduce((s, i) => s + i.qty, 0);
    const totalPrice = items.reduce((s, i) => s + i.qty * i.price, 0);
    return { items, totalQty, totalPrice };
  }

  function setQty(itemId, qty) {
    setCartMeta(prev => {
      const copy = { ...prev, items: { ...prev.items } };
      if (!qty || qty <= 0) delete copy.items[itemId];
      else copy.items[itemId] = Number(qty);
      localStorage.setItem(CART_KEY, JSON.stringify(copy));
      return copy;
    });
  }

  function increment(id) { setQty(id, (cartMeta.items[id] || 0) + 1); }
  function decrement(id) { setQty(id, Math.max(0, (cartMeta.items[id] || 0) - 1)); }

  // Add address
  async function saveNewAddress() {
    setAddrMsg("");
    if (!newAddr.address || !/^\d{6}$/.test(newAddr.pincode || "")) {
      return setAddrMsg("Address and 6-digit pincode required");
    }
    try {
      const res = await apiFetch("/api/customers/addresses", {
        method: "POST",
        body: JSON.stringify({ label: newAddr.label, address: newAddr.address, pincode: newAddr.pincode, phone: newAddr.phone })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Add address failed");
      }
      const data = await res.json();
      setAddresses(prev => [...prev, data]);
      setAddrModalOpen(false);
      setNewAddr({ label: "", address: "", pincode: "", phone: "" });
    } catch (e) {
      console.error("save addr", e);
      setAddrMsg("Failed to add address");
    }
  }

  // Place order (customer must be logged in)
  async function placeOrderWithAddress(addr) {
    setMsg("");
    if (!cartMeta.selectedShop || !cartMeta.selectedShop._id) return setMsg("No shop selected");
    const shopId = cartMeta.selectedShop._id;
    // check pincode vs shop pincode
    try {
      const shopRes = await fetch(`${API_BASE}/api/shops?` + new URLSearchParams({ pincode: addr.pincode }));
      // this returns shops filtered by pincode - ensure our selected shop exists in this list
      const shops = await shopRes.json();
      const match = shops.find(s => String(s._id) === String(shopId));
      if (!match) {
        return setMsg(`This shop does not deliver to pincode ${addr.pincode}. Shop pincode is ${ (cartMeta.selectedShop && cartMeta.selectedShop.pincode) || "—" }`);
      }
    } catch (e) {
      console.error("pincode check", e);
    }

    // prepare payload
    const { items, totalPrice } = cartSummary();
    if (!items.length) return setMsg("Cart is empty");
    const payload = {
      shop: shopId,
      customerName: (localStorage.getItem("customer_name") || "").trim() || "Customer",
      phone: addr.phone && addr.phone.length ? addr.phone : (localStorage.getItem("customer_phone") || ""),
      address: { label: addr.label || "", address: addr.address, pincode: addr.pincode, phone: addr.phone || "" },
      items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    };

    setPlacing(true);
    try {
      const res = await apiFetch("/api/orders", { method: "POST", body: JSON.stringify(payload) });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Order failed");
      }
      const order = await res.json();
      // clear cart for this shop
      localStorage.removeItem(CART_KEY);
      setCartMeta({ selectedShop: null, items: {} });
      // navigate to order status page (we route to customer dashboard order detail)
      navigate(`/profile?orderId=${order._id}`);
    } catch (e) {
      console.error("place order", e);
      setMsg("Order failed: " + (e.message || e));
    } finally {
      setPlacing(false);
    }
  }

  // If not logged in, redirect to login
  if (!getCustomerToken()) {
    return (
      <div className="min-h-screen p-6 bg-gray-50">
        <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow text-center">
          <h2 className="text-xl font-semibold mb-3">You need to login to continue</h2>
          <div className="mb-4">Please login with OTP to view cart and place order.</div>
          <div className="flex justify-center gap-2">
            <button onClick={() => navigate("/customer-login")} className="px-4 py-2 bg-blue-600 text-white rounded">Login / Verify OTP</button>
            <button onClick={() => navigate("/shops")} className="px-4 py-2 bg-gray-200 rounded">Back to shops</button>
          </div>
        </div>
      </div>
    );
  }

  const { items, totalQty, totalPrice } = cartSummary();

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Cart — {cartMeta.selectedShop ? cartMeta.selectedShop.name : "No shop selected"}</h2>
          <div className="text-sm text-gray-600">Items: <b>{totalQty}</b> • Total: ₹{totalPrice}</div>
        </div>

        {msg && <div className="text-sm text-red-600 mb-3">{msg}</div>}

        {items.length === 0 ? (
          <div>No items in cart. <button onClick={() => navigate("/shops")} className="text-blue-600">Browse shops</button></div>
        ) : (
          <div className="space-y-3">
            {items.map(i => (
              <div key={i._id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">{i.name} • ₹{i.price}</div>
                  <div className="text-xs text-gray-500">Qty: {i.qty}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => decrement(i._id)} className="px-2 py-1 bg-gray-200 rounded">−</button>
                  <div className="px-3 py-1 border rounded">{i.qty}</div>
                  <button onClick={() => increment(i._id)} className="px-2 py-1 bg-gray-200 rounded">+</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <h4 className="font-medium mb-2">Select delivery address</h4>
          {addresses.length === 0 ? (
            <div>
              <div className="text-sm text-gray-600 mb-3">No saved addresses. Add one to continue.</div>
              <button onClick={() => setAddrModalOpen(true)} className="px-3 py-2 bg-blue-600 text-white rounded">Add address</button>
            </div>
          ) : (
            <div className="space-y-2">
              {addresses.map(a => (
                <div key={a._id} className="p-3 border rounded flex justify-between items-center">
                  <div>
                    <div className="font-medium">{a.label || "Address"}</div>
                    <div className="text-sm text-gray-600">{a.address} • {a.pincode}</div>
                    <div className="text-xs text-gray-500">{a.phone}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => placeOrderWithAddress(a)} className="px-3 py-1 bg-green-600 text-white rounded" disabled={placing}>Use & Pay</button>
                    <button onClick={() => {
                      // quick edit uses simple inline prompt (non-blocking)
                      const addrText = prompt("Edit address text", a.address);
                      if (!addrText) return;
                      const pin = prompt("Pincode (6 digits)", a.pincode);
                      if (!pin || !/^\d{6}$/.test(pin)) { alert("Invalid pincode"); return; }
                      apiFetch(`/api/customers/addresses/${a._id}`, { method: "PATCH", body: JSON.stringify({ address: addrText, pincode: pin }) })
                        .then(r => { if (!r.ok) return r.text().then(t => Promise.reject(t)); return r.json(); })
                        .then(() => loadAddresses())
                        .catch(e => alert("Update failed"));
                    }} className="px-3 py-1 bg-gray-200 rounded">Edit</button>
                  </div>
                </div>
              ))}
              <div className="mt-3">
                <button onClick={() => setAddrModalOpen(true)} className="px-3 py-2 bg-blue-600 text-white rounded">Add another address</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add address modal */}
      {addrModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white p-4 rounded w-[520px]">
            <h3 className="font-semibold mb-2">Add address</h3>
            <input value={newAddr.label} onChange={e => setNewAddr(prev => ({ ...prev, label: e.target.value }))} placeholder="Label (Home / Work)" className="p-2 border rounded w-full mb-2" />
            <textarea value={newAddr.address} onChange={e => setNewAddr(prev => ({ ...prev, address: e.target.value }))} placeholder="Full address" className="p-2 border rounded w-full mb-2" />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input value={newAddr.pincode} onChange={e => setNewAddr(prev => ({ ...prev, pincode: e.target.value.replace(/\D/g,'').slice(0,6) }))} placeholder="Pincode (6 digits)" className="p-2 border rounded" />
              <input value={newAddr.phone} onChange={e => setNewAddr(prev => ({ ...prev, phone: e.target.value.replace(/\D/g,'').slice(0,15) }))} placeholder="Phone (optional)" className="p-2 border rounded" />
            </div>
            {addrMsg && <div className="text-sm text-red-600 mb-2">{addrMsg}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setAddrModalOpen(false); setAddrMsg(""); }} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
              <button onClick={saveNewAddress} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// frontend/src/components/Cart.jsx
import React, { useEffect, useState } from "react";

/**
 * Cart component with integrated address editor inside the checkout modal.
 *
 * Props:
 *   modal (bool) - if true, renders the full checkout modal
 *   items, totalQty, totalPrice - inline mode values
 *   onIncrement(id), onDecrement(id), onRemove(id)
 *   onPlaceOrder() - used inline to open checkout in parent
 *   disabled - boolean (shop offline)
 *
 * Modal props (when modal=true):
 *   items, total (number),
 *   addresses (array),
 *   onAddOrUpdateAddress(addr, editIndex) -> should return saved array in parent
 *   onDeleteAddress(idx) -> parent handles deletion & returns updated array
 *   onSetDefault(idx) -> parent sets default
 *   onConfirm(addressIdx) -> async place order; returns {ok, order, message}
 *   onClose()
 */

export default function Cart(props) {
  const {
    modal = false,
    items = [],
    totalQty = 0,
    totalPrice = 0,
    onIncrement = () => {},
    onDecrement = () => {},
    onRemove = () => {},
    onPlaceOrder = () => {},
    disabled = false,

    // modal props
    onClose = () => {},
    total = 0,
    addresses = [],
    onAddOrUpdateAddress = () => Promise.resolve([]),
    onDeleteAddress = () => Promise.resolve([]),
    onSetDefault = () => Promise.resolve([]),
    onConfirm = async () => ({ ok: false, message: "not implemented" }),
  } = props;

  // local modal state
  const [selectedAddressIdx, setSelectedAddressIdx] = useState(() => {
    const defIdx = addresses.findIndex(a => a && a.default);
    return defIdx >= 0 ? defIdx : (addresses.length ? 0 : -1);
  });
  const [confirming, setConfirming] = useState(false);

  // address editor inside modal
  const [editingIndex, setEditingIndex] = useState(-1);
  const [addressForm, setAddressForm] = useState({ name: "", phone: "", address: "", pincode: "" });
  const [addrErr, setAddrErr] = useState("");

  useEffect(() => {
    const defIdx = addresses.findIndex(a => a && a.default);
    setSelectedAddressIdx(defIdx >= 0 ? defIdx : (addresses.length ? 0 : -1));
  }, [addresses]);

  // helper validation
  function validateAddress(form) {
    if (!form.name || form.name.trim().length < 2) return "Name required";
    if (!/^\d{10}$/.test(String(form.phone || "").replace(/\D/g, ""))) return "Phone must be 10 digits";
    if (!form.address || form.address.trim().length < 5) return "Address required (min 5 chars)";
    if (!/^\d{6}$/.test(String(form.pincode || "").trim())) return "Pincode must be 6 digits";
    return null;
  }

  async function saveAddress() {
    setAddrErr("");
    const err = validateAddress(addressForm);
    if (err) { setAddrErr(err); return; }
    try {
      const updated = await onAddOrUpdateAddress({ ...addressForm }, editingIndex >= 0 ? editingIndex : null);
      setEditingIndex(-1);
      setAddressForm({ name: "", phone: "", address: "", pincode: "" });
      // choose default if no selected
      if (selectedAddressIdx === -1 && updated && updated.length) {
        const defIdx = updated.findIndex(a => a.default);
        setSelectedAddressIdx(defIdx >= 0 ? defIdx : 0);
      }
    } catch (e) {
      setAddrErr(e.message || String(e) || "Save failed");
    }
  }

  function startEditAddress(idx) {
    if (typeof idx !== "number") return;
    setEditingIndex(idx);
    const a = addresses[idx] || { name: "", phone: "", address: "", pincode: "" };
    setAddressForm({ ...a });
    setAddrErr("");
  }

  async function doDeleteAddress(idx) {
    if (idx < 0 || idx >= addresses.length) return;
    // default address cannot be deleted while it's the only address; parent is authoritative
    try {
      const updated = await onDeleteAddress(idx);
      // update selection
      if (!updated || updated.length === 0) setSelectedAddressIdx(-1);
      else {
        const defIdx = updated.findIndex(a => a && a.default);
        setSelectedAddressIdx(defIdx >= 0 ? defIdx : 0);
      }
    } catch (e) {
      alert("Delete failed: " + (e.message || e));
    }
  }

  async function makeDefault(idx) {
    try {
      const updated = await onSetDefault(idx);
      const defIdx = updated.findIndex(a => a && a.default);
      setSelectedAddressIdx(defIdx >= 0 ? defIdx : (updated.length ? 0 : -1));
    } catch (e) {
      alert("Failed to set default: " + (e.message || e));
    }
  }

  // Inline (non-modal) rendering
  if (!modal) {
    return (
      <div className="bg-white border rounded p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">Cart: <span className="text-gray-700">{totalQty}</span> items</div>
          <div className="font-medium">Total: <span className="text-gray-700">₹{totalPrice}</span></div>
        </div>

        {items.length === 0 ? (
          <div className="text-sm text-gray-500 mb-3">Cart is empty</div>
        ) : (
          <div className="space-y-2 mb-3">
            {items.map(it => (
              <div key={it._id} className="flex items-center justify-between border rounded p-2">
                <div>
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-gray-500">₹{it.price} • qty {it.qty}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => onDecrement(it._id)} className="px-2 py-1 bg-gray-200 rounded">−</button>
                  <div className="px-3 py-1 border rounded">{it.qty}</div>
                  <button onClick={() => onIncrement(it._id)} className="px-2 py-1 bg-gray-200 rounded">+</button>
                  <button onClick={() => onRemove(it._id)} className="px-2 py-1 bg-red-500 text-white rounded ml-2">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={() => onPlaceOrder()}
            disabled={disabled || items.length === 0}
            className={`px-4 py-2 rounded ${disabled || items.length === 0 ? "bg-gray-300 text-gray-600" : "bg-green-600 text-white"}`}
          >
            Checkout
          </button>
        </div>
      </div>
    );
  }

  // Modal rendering (checkout)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded shadow-lg w-full max-w-3xl overflow-auto" style={{ maxHeight: "90vh" }}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Your Cart</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Close</button>
          </div>
        </div>

        <div className="p-4">
          {items.length === 0 ? (
            <div className="text-sm text-gray-500 mb-4">Cart is empty</div>
          ) : (
            <div className="space-y-3 mb-4">
              {items.map(it => (
                <div key={it._id} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-gray-500">₹{it.price} • qty {it.qty}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onDecrement(it._id)} className="px-2 py-1 bg-gray-200 rounded">−</button>
                    <div className="px-3 py-1 border rounded">{it.qty}</div>
                    <button onClick={() => onIncrement(it._id)} className="px-2 py-1 bg-gray-200 rounded">+</button>
                    <button onClick={() => onRemove(it._id)} className="px-2 py-1 bg-red-500 text-white rounded ml-2">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">Items: <b>{items.reduce((s, i) => s + i.qty, 0)}</b></div>
            <div className="text-lg font-semibold">Total: ₹{total || items.reduce((s, i) => s + i.qty * i.price, 0)}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium">Delivery Address</div>
                <div>
                  <button onClick={() => { setEditingIndex(-1); setAddressForm({ name: "", phone: "", address: "", pincode: "" }); setAddrErr(""); }} className="px-2 py-1 bg-gray-200 rounded text-sm">Add</button>
                </div>
              </div>

              {(!addresses || addresses.length === 0) ? (
                <div className="text-sm text-gray-500">No saved addresses. Add one to continue.</div>
              ) : (
                <div className="space-y-2">
                  {addresses.map((a, idx) => (
                    <div key={idx} className={`p-3 border rounded ${selectedAddressIdx === idx ? "ring-2 ring-indigo-300 bg-indigo-50" : ""}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{a.name} {a.default ? <span className="text-xs text-green-700 ml-2">(Default)</span> : null}</div>
                          <div className="text-xs text-gray-600">+91{(a.phone || "").replace(/\D/g, "")}</div>
                          <div className="text-xs text-gray-600">{a.address}</div>
                          <div className="text-xs text-gray-500">Pincode: {a.pincode}</div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div>
                            <label className="inline-flex items-center cursor-pointer">
                              <input type="radio" checked={selectedAddressIdx === idx} onChange={() => setSelectedAddressIdx(idx)} className="mr-2" />
                              Select
                            </label>
                          </div>

                          <div className="flex gap-2">
                            <button onClick={() => startEditAddress(idx)} className="px-2 py-1 bg-yellow-400 rounded text-sm">Edit</button>
                            <button onClick={() => makeDefault(idx)} disabled={a.default} className={`px-2 py-1 rounded text-sm ${a.default ? "bg-gray-200" : "bg-blue-600 text-white"}`}>Make default</button>
                            <button onClick={() => {
                              // attempt delete, parent will enforce default rules
                              if (a.default && addresses.length === 1) {
                                alert("Default address cannot be deleted. Add another address and set it default first.");
                                return;
                              }
                              if (!confirm("Delete this address?")) return;
                              doDeleteAddress(idx);
                            }} className="px-2 py-1 bg-red-400 text-white rounded text-sm">Delete</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* address editor (inline inside modal) */}
              <div className="mt-4 border-t pt-3">
                <h4 className="font-medium mb-2">{editingIndex >= 0 ? "Edit Address" : "Add Address"}</h4>
                <div className="grid grid-cols-1 gap-2">
                  <input value={addressForm.name} onChange={e => setAddressForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" className="p-2 border rounded" />
                  <div className="flex">
                    <span className="px-3 py-2 bg-gray-100 select-none">+91</span>
                    <input value={addressForm.phone} onChange={e => setAddressForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0,10) }))} placeholder="10-digit phone" className="p-2 border rounded flex-1" />
                  </div>
                  <textarea value={addressForm.address} onChange={e => setAddressForm(f => ({ ...f, address: e.target.value }))} placeholder="Address" className="p-2 border rounded h-20" />
                  <input value={addressForm.pincode} onChange={e => setAddressForm(f => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0,6) }))} placeholder="Pincode (6 digits)" className="p-2 border rounded" />
                  {addrErr ? <div className="text-sm text-red-600">{addrErr}</div> : null}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setEditingIndex(-1); setAddressForm({ name: "", phone: "", address: "", pincode: "" }); setAddrErr(""); }} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
                    <button onClick={saveAddress} className="px-3 py-1 bg-blue-600 text-white rounded">Save Address</button>
                  </div>
                </div>
              </div>

            </div>

            <div>
              <div className="font-medium mb-2">Confirm & Place Order</div>
              <div className="text-sm text-gray-600 mb-3">Select an address (default selected) and click Place Order. If pincode doesn't match shop, you'll be notified by the server.</div>

              <div>
                <button
                  onClick={async () => {
                    if (selectedAddressIdx === -1) { alert("Select or add an address first"); return; }
                    setConfirming(true);
                    try {
                      const res = await onConfirm(selectedAddressIdx);
                      if (res && res.ok) {
                        alert("Order placed successfully");
                        onClose();
                      } else {
                        alert("Order failed: " + (res && res.message ? res.message : "Unknown error"));
                      }
                    } finally {
                      setConfirming(false);
                    }
                  }}
                  className={`px-4 py-2 rounded ${confirming ? "bg-gray-300" : "bg-green-600 text-white"}`}
                  disabled={confirming || items.length === 0 || selectedAddressIdx === -1}
                >
                  {confirming ? "Placing..." : "Place Order"}
                </button>
                <button onClick={onClose} className="ml-2 px-3 py-2 bg-gray-200 rounded">Cancel</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

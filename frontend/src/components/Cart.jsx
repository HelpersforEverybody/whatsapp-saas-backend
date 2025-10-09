// frontend/src/components/Cart.jsx
import React, { useMemo, useState, useEffect } from "react";

/**
 * Props expected:
 *  - items: [{ _id, name, qty, price }]
 *  - totalQty
 *  - totalPrice
 *  - addresses: array of { label, address, phone, pincode, default?: boolean, _id? }
 *  - onAddAddress() -> opens address modal (for add)
 *  - onEditAddress(idx) -> open edit modal for address idx
 *  - onDeleteAddress(idx) -> delete address
 *  - onClose()
 *  - onConfirm(addressIdx) -> place order with selected address
 *
 * This component intentionally does not manage persistence; it just calls callbacks.
 */
export default function Cart({
  items = [],
  totalQty = 0,
  totalPrice = 0,
  addresses = [],
  onAddAddress = () => {},
  onEditAddress = () => {},
  onDeleteAddress = () => {},
  onClose = () => {},
  onConfirm = () => {},
}) {
  const [selectedIdx, setSelectedIdx] = useState(() => {
    // prefer default address
    const def = addresses.findIndex(a => a.default || a.isDefault);
    return def >= 0 ? def : (addresses.length ? 0 : -1);
  });

  // keep selectedIdx synced when addresses change
  useEffect(() => {
    if (!addresses || addresses.length === 0) {
      setSelectedIdx(-1);
      return;
    }
    // if selected index still valid, keep it
    if (selectedIdx >= 0 && selectedIdx < addresses.length) return;
    // try to select default
    const def = addresses.findIndex(a => a.default || a.isDefault);
    if (def >= 0) setSelectedIdx(def);
    else setSelectedIdx(0);
  }, [addresses, selectedIdx]);

  const canPlace = items.length > 0 && selectedIdx >= 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg w-[90%] max-w-2xl p-4 shadow-lg z-[10000]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Cart — {items.length} {items.length === 1 ? "item" : "items"}</h3>
          <button className="px-3 py-1 bg-gray-100 rounded" onClick={onClose}>Close</button>
        </div>

        {/* items */}
        <div className="space-y-3 mb-4">
          {items.length === 0 ? (
            <div className="text-sm text-gray-600">Cart is empty</div>
          ) : items.map(it => (
            <div key={it._id} className="p-3 border rounded bg-white flex justify-between items-center">
              <div>
                <div className="font-medium">{it.name}</div>
                <div className="text-sm text-gray-600">Qty: {it.qty} × ₹{it.price}</div>
              </div>
              <div className="text-sm font-semibold">₹{it.qty * it.price}</div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-600">Total:</div>
          <div className="text-xl font-semibold">₹{totalPrice}</div>
        </div>

        {/* Delivery address area */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Delivery Address</h4>
            <div className="flex gap-2">
              {/* Change/Add button; keep semantics: allow user to open address manager */}
              <button onClick={onAddAddress} className="px-3 py-1 bg-blue-600 text-white rounded">Change / Add</button>
            </div>
          </div>

          {(!addresses || addresses.length === 0) ? (
            <div className="text-sm text-gray-600 p-3 border rounded">No addresses saved</div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-auto pr-2">
              {addresses.map((a, idx) => {
                // display phone: if already includes +91 and you want to prefix +91 in UI,
                // avoid duplicate. We'll display normalized: show +91 only once.
                const raw = String(a.phone || "");
                const digits = raw.replace(/\D/g, "");
                const phoneForUI = digits.length === 10 ? `+91${digits}` : (raw.startsWith('+') ? raw : `+${digits}`);

                return (
                  <div key={idx} className={`p-3 border rounded ${selectedIdx === idx ? "bg-blue-50" : "bg-white"}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <input type="radio" checked={selectedIdx === idx} onChange={() => setSelectedIdx(idx)} />
                          <div>
                            <div className="font-medium">{a.label || "Home" } {a.default || a.isDefault ? <span className="text-xs text-blue-600 ml-2">Default</span> : null}</div>
                            <div className="text-sm text-gray-700">{a.address}</div>
                            <div className="text-xs text-gray-500 mt-1">{a.pincode ? a.pincode : ""} • {phoneForUI}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {/* Edit */}
                        <button onClick={() => onEditAddress(idx)} className="px-2 py-1 border rounded text-sm">Edit</button>
                        {/* Delete (disabled if default) */}
                        <button
                          onClick={() => onDeleteAddress(idx)}
                          className={`px-2 py-1 rounded text-sm ${ (a.default || a.isDefault) ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-red-100 text-red-700"}`}
                          disabled={!!(a.default || a.isDefault)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* actions */}
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
          <button
            onClick={() => onConfirm(selectedIdx)}
            disabled={!canPlace}
            className={`px-4 py-2 rounded ${canPlace ? "bg-green-600 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
          >
            Place Order
          </button>
        </div>
      </div>
    </div>
  );
}

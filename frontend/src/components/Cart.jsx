// frontend/src/components/Cart.jsx
import React, { useEffect, useState } from "react";

/**
 * Props expected:
 *  - items: [{ _id, name, qty, price }]
 *  - totalQty
 *  - totalPrice
 *  - addresses: array of { label, address, phone, pincode, default?: boolean, isDefault?: boolean, _id? }
 *  - onAddAddress() -> opens address modal (for add)
 *  - onEditAddress(idx) -> open edit modal for address idx
 *  - onDeleteAddress(idx) -> delete address
 *  - onClose()
 *  - onConfirm(addressIdx) -> place order with selected address
 *
 * Behavior:
 *  - Show only selected address summary by default
 *  - "Change address" toggles inline address list
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
  // prefer default address (isDefault or default) else first
  const initialSelected = (() => {
    const defIndex = addresses.findIndex(a => a.isDefault || a.default);
    if (defIndex >= 0) return defIndex;
    if (addresses.length) return 0;
    return -1;
  })();

  const [selectedIdx, setSelectedIdx] = useState(initialSelected);
  const [showAddressList, setShowAddressList] = useState(false);

  // sync selection if addresses change
  useEffect(() => {
    if (!addresses || addresses.length === 0) {
      setSelectedIdx(-1);
      return;
    }
    // if current selection still valid, keep it
    if (selectedIdx >= 0 && selectedIdx < addresses.length) return;
    // try default
    const def = addresses.findIndex(a => a.isDefault || a.default);
    if (def >= 0) setSelectedIdx(def);
    else setSelectedIdx(0);
  }, [addresses, selectedIdx]);

  const canPlace = items.length > 0 && selectedIdx >= 0;

  // helper: normalized phone for display (+91 only once)
  function phoneForUI(p) {
    const raw = String(p || "");
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 10) return `+91${digits}`;
    if (raw.startsWith("+")) return raw;
    return `+${digits}`;
  }

  const selectedAddress = (selectedIdx >= 0 && addresses[selectedIdx]) ? addresses[selectedIdx] : null;

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

        {/* Delivery address summary */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Delivery Address</h4>
            <div className="flex gap-2">
              {/* Change address button (single label) */}
              <button
                onClick={() => setShowAddressList(s => !s)}
                className="px-3 py-1 bg-blue-600 text-white rounded"
              >
                Change address
              </button>
            </div>
          </div>

          {/* If no addresses show helpful UI */}
          {(!addresses || addresses.length === 0) ? (
            <div className="text-sm text-gray-600 p-3 border rounded flex items-center justify-between">
              <div>No addresses saved</div>
              <div>
                <button onClick={onAddAddress} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Add address</button>
              </div>
            </div>
          ) : (
            <>
              {/* Selected address summary (always visible) */}
              <div className="p-3 border rounded bg-white mb-3">
                {selectedAddress ? (
                  <div className="flex items-start gap-3">
                    <div>
                      <div className="font-medium">{selectedAddress.label || "Home"} { (selectedAddress.default || selectedAddress.isDefault) ? <span className="text-xs text-blue-600 ml-2">Default</span> : null }</div>
                      <div className="text-sm mt-1">{selectedAddress.address}</div>
                      <div className="text-xs text-gray-500 mt-1">{selectedAddress.pincode ? selectedAddress.pincode + " • " : ""}{phoneForUI(selectedAddress.phone)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">Select an address</div>
                )}
              </div>

              {/* Inline address list (expanded when clicking Change address) */}
              {showAddressList && (
                <div className="space-y-3 max-h-64 overflow-auto pr-2 mb-3">
                  {addresses.map((a, idx) => (
                    <div key={idx} className={`p-3 border rounded ${selectedIdx === idx ? "bg-blue-50" : "bg-white"}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            checked={selectedIdx === idx}
                            onChange={() => setSelectedIdx(idx)}
                            className="mt-1"
                          />
                          <div>
                            <div className="font-medium">{a.label || "Home"} { (a.default || a.isDefault) ? <span className="text-xs text-blue-600 ml-2">Default</span> : null }</div>
                            <div className="text-sm text-gray-700">{a.address}</div>
                            <div className="text-xs text-gray-500 mt-1">{a.pincode ? a.pincode + " • " : ""}{phoneForUI(a.phone)}</div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <button onClick={() => onEditAddress(idx)} className="px-2 py-1 border rounded text-sm">Edit</button>
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
                  ))}
                  <div className="flex justify-end">
                    <button onClick={onAddAddress} className="px-3 py-1 bg-green-600 text-white rounded text-sm">+ Add new address</button>
                  </div>
                </div>
              )}
            </>
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

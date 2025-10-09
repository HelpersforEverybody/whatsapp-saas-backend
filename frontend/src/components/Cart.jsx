// frontend/src/components/Cart.jsx
import React, { useEffect, useState } from "react";

/**
 * Props:
 * - items: array of { _id, name, qty, price }
 * - totalQty, totalPrice
 * - addresses: array of { label, address, phone, pincode } (or objects with _id if server)
 * - onAddAddress(): opens parent Add Address UI
 * - onEditAddress(idx): edits address at index (parent should open edit modal)
 * - onDeleteAddress(idx): deletes address at index
 * - onClose(): close cart modal
 * - onConfirm(addressIdx): confirm order with selected address index (returns promise or result)
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
  onConfirm = async () => ({ ok: false, message: "not implemented" }),
}) {
  // selected index among addresses (null if none)
  const [selectedIdx, setSelectedIdx] = useState(
    addresses && addresses.length ? 0 : null
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // keep selected idx valid when addresses list changes
  useEffect(() => {
    if (!addresses || addresses.length === 0) {
      setSelectedIdx(null);
      return;
    }
    // try to keep same index if possible, otherwise clamp to 0
    if (selectedIdx === null || selectedIdx >= addresses.length) {
      setSelectedIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses]);

  async function confirmOrder() {
    setErr("");
    if (!addresses || addresses.length === 0) {
      setErr("Please add a delivery address first.");
      return;
    }
    if (selectedIdx === null || typeof selectedIdx === "undefined") {
      setErr("Please select a delivery address.");
      return;
    }

    setBusy(true);
    try {
      const result = await onConfirm(selectedIdx);
      if (!result || !result.ok) {
        setErr(result && result.message ? result.message : "Order failed");
      } else {
        // success - parent may close modal
      }
    } catch (e) {
      setErr(e && e.message ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded shadow-lg w-full max-w-2xl">
        <div className="p-4 border-b flex items-start justify-between">
          <h3 className="text-lg font-semibold">Cart — {items.length} items</h3>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1 bg-gray-100 rounded border">Close</button>
          </div>
        </div>

        <div className="p-4 max-h-[60vh] overflow-auto">
          {/* Items */}
          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="text-sm text-gray-500">Cart is empty</div>
            ) : (
              items.map(it => (
                <div key={it._id} className="p-3 border rounded flex justify-between items-center bg-white">
                  <div>
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-gray-500">Qty: {it.qty} × ₹{it.price}</div>
                  </div>
                  <div className="font-medium">₹{it.qty * it.price}</div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">Total:</div>
              <div className="text-xl font-semibold">₹{totalPrice}</div>
            </div>
          </div>

          {/* Delivery address */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Delivery Address</h4>
              {/* Replace Add/Edit with single Change Address */}
              <div>
                <button
                  onClick={() => {
                    // toggle inline picker
                    setPickerOpen(v => !v);
                  }}
                  className="px-3 py-1 bg-gray-100 rounded border"
                >
                  {pickerOpen ? "Close" : "Change Address"}
                </button>
              </div>
            </div>

            {/* Show single selected address when picker closed */}
            {!pickerOpen && (
              <div className="p-3 border rounded bg-gray-50">
                {selectedIdx === null ? (
                  <div className="text-sm text-gray-600">No address selected</div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <div>
                        <div className="font-medium">{addresses[selectedIdx].label || "Home"}</div>
                        <div className="text-sm">{addresses[selectedIdx].address}</div>
                        <div className="text-xs text-gray-500 mt-2">
                          {addresses[selectedIdx].phone ? addresses[selectedIdx].phone + " • " : ""}{addresses[selectedIdx].pincode || ""}
                        </div>
                      </div>
                      <div className="ml-4 text-sm text-gray-600"> </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Inline picker */}
            {pickerOpen && (
              <div className="mt-3 space-y-3">
                {/* Add button */}
                <div className="flex justify-end">
                  <button onClick={() => onAddAddress()} className="px-3 py-1 bg-blue-600 text-white rounded">+ Add New</button>
                </div>

                {/* Addresses list */}
                {(!addresses || addresses.length === 0) ? (
                  <div className="p-3 border rounded text-sm text-gray-600">No addresses saved</div>
                ) : (
                  addresses.map((addr, idx) => (
                    <div key={idx} className={`p-3 border rounded ${selectedIdx === idx ? "bg-blue-50" : "bg-white"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div>
                            <input
                              type="radio"
                              name="cart_addr"
                              checked={selectedIdx === idx}
                              onChange={() => setSelectedIdx(idx)}
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{addr.label || "Home"}</div>
                              {idx === 0 && <div className="text-xs text-blue-600">Default</div>}
                            </div>
                            <div className="text-sm">{addr.address}</div>
                            <div className="text-xs text-gray-500 mt-2">
                              {addr.phone ? addr.phone + " • " : ""}{addr.pincode || ""}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div>
                            <button onClick={() => onEditAddress(idx)} className="px-2 py-1 bg-gray-100 rounded border mr-2">Edit</button>
                            <button onClick={() => onDeleteAddress(idx)} className="px-2 py-1 bg-red-50 text-red-600 rounded border">Delete</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {err && <div className="text-sm text-red-600 mt-3">{err}</div>}
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
          <button onClick={confirmOrder} disabled={busy} className="px-4 py-2 bg-green-600 text-white rounded">
            {busy ? "Placing..." : "Place Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

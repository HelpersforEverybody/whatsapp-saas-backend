// frontend/src/components/Cart.jsx
import React, { useState } from "react";

/**
 * Props:
 * - items: [{ _id, name, qty, price }]
 * - total: number
 * - addresses: [{ name, phone, address, pincode }]
 * - onAddAddress(): open address modal
 * - onDeleteAddress(idx)
 * - onSaveAddress(addr) // optional
 * - onConfirm(addressIndex) -> should return result { ok, message }
 * - onClose()
 */

export default function Cart({ items = [], total = 0, addresses = [], onAddAddress, onDeleteAddress, onSaveAddress, onConfirm, onClose }) {
  const [selectedAddressIdx, setSelectedAddressIdx] = useState(addresses.length ? 0 : -1);
  const [loading, setLoading] = useState(false);

  async function confirm() {
    if (selectedAddressIdx === -1) {
      return alert("Select or add an address before confirming");
    }
    try {
      setLoading(true);
      const res = await onConfirm(selectedAddressIdx);
      return res;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-2xl rounded shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium">Cart & Checkout</h3>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Close</button>
          </div>
        </div>

        <div className="mb-3">
          {items.length === 0 ? <div>No items in cart</div> : (
            <div className="space-y-2">
              {items.map(it => (
                <div key={it._id} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-gray-600">Qty: {it.qty} • ₹{it.price} each</div>
                  </div>
                  <div>₹{it.qty * it.price}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-3">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-gray-600">Total</div>
            <div className="font-medium">₹{total}</div>
          </div>

          <div>
            <div className="mb-2 font-medium">Delivery Address</div>
            {addresses.length === 0 ? (
              <div className="mb-2 text-sm text-gray-600">No saved addresses. Please add one.</div>
            ) : (
              <div className="space-y-2 mb-2">
                {addresses.map((a, idx) => (
                  <label key={idx} className={`p-2 border rounded flex items-start gap-3 ${selectedAddressIdx === idx ? "bg-blue-50 border-blue-300" : ""}`}>
                    <input type="radio" checked={selectedAddressIdx === idx} onChange={() => setSelectedAddressIdx(idx)} />
                    <div>
                      <div className="font-medium">{a.name} • +91{a.phone}</div>
                      <div className="text-xs text-gray-600">{a.address} • {a.pincode}</div>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <button onClick={() => onDeleteAddress(idx)} className="px-2 py-1 bg-red-500 text-white rounded text-sm">Delete</button>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={onAddAddress} className="px-3 py-1 bg-gray-200 rounded">Add Address</button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
          <button onClick={async () => {
            const res = await confirm();
            if (res && res.ok) {
              alert("Order placed: " + (res.order && (res.order.orderNumber ? `#${String(res.order.orderNumber).padStart(6,'0')}` : String(res.order._id).slice(0,8))));
              onClose();
            } else {
              alert("Place order failed: " + (res && res.message ? res.message : "unknown"));
            }
          }} className="px-3 py-1 bg-green-600 text-white rounded" disabled={loading}>{loading ? "Placing..." : "Confirm Order"}</button>
        </div>
      </div>
    </div>
  );
}

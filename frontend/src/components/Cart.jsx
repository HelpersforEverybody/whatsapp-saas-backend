// frontend/src/components/Cart.jsx
import React, { useState } from "react";

/**
 * Simple Cart modal / drawer used by ShopManager.
 *
 * Props:
 * - items: [{ _id, name, qty, price }]
 * - totalQty, totalPrice
 * - addresses: array of saved addresses (each: {name, phone, address, pincode})
 * - onAddAddress() - open address modal
 * - onDeleteAddress(idx)
 * - onClose()
 * - onConfirm(addressIdx) -> async confirm -> returns result
 */

export default function Cart({
  items = [],
  totalQty = 0,
  totalPrice = 0,
  addresses = [],
  onAddAddress = () => {},
  onDeleteAddress = () => {},
  onClose = () => {},
  onConfirm = async () => ({ ok: false }),
}) {
  const [selectedAddressIdx, setSelectedAddressIdx] = useState(addresses.length ? 0 : -1);
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded w-[700px] max-h-[90vh] overflow-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Cart — {totalQty} items</h3>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Close</button>
          </div>
        </div>

        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="text-sm text-gray-600">Cart is empty</div>
          ) : (
            items.map(it => (
              <div key={it._id} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <div className="font-medium">{it.name}</div>
                  <div className="text-sm text-gray-600">Qty: {it.qty} × ₹{it.price}</div>
                </div>
                <div className="text-sm font-medium">₹{it.qty * it.price}</div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 border-t pt-3">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm text-gray-700">Total:</div>
            <div className="text-xl font-semibold">₹{totalPrice}</div>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Delivery Address</div>
              <div>
                <button onClick={onAddAddress} className="px-3 py-1 bg-gray-200 rounded">Add / Edit</button>
              </div>
            </div>

            <div className="mt-2 space-y-2">
              {addresses.length === 0 ? (
                <div className="text-sm text-gray-600">No saved addresses. Add one to continue.</div>
              ) : (
                addresses.map((a, idx) => (
                  <label key={idx} className={`block p-2 border rounded cursor-pointer ${selectedAddressIdx === idx ? "bg-blue-50" : ""}`}>
                    <input
                      type="radio"
                      name="cart_address"
                      checked={selectedAddressIdx === idx}
                      onChange={() => setSelectedAddressIdx(idx)}
                      className="mr-2"
                    />
                    <span className="font-medium">{a.name}</span> — <span className="text-sm text-gray-600">+91{a.phone} • {a.pincode}</span>
                    <div className="text-sm text-gray-700 mt-1">{a.address}</div>
                    <div className="mt-2">
                      <button onClick={(e) => { e.stopPropagation(); onDeleteAddress(idx); if (selectedAddressIdx === idx) setSelectedAddressIdx(-1); }} className="px-2 py-1 bg-gray-200 rounded text-sm">Delete</button>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
            <button
              onClick={async () => {
                if (selectedAddressIdx < 0) {
                  alert("Select or add an address first");
                  return;
                }
                const res = await onConfirm(selectedAddressIdx);
                if (!res.ok) {
                  alert("Failed: " + (res.message || "unknown"));
                }
              }}
              className="px-4 py-2 bg-green-600 text-white rounded"
              disabled={addresses.length === 0}
            >
              Place Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

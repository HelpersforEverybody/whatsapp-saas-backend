// frontend/src/components/Cart.jsx
import React, { useEffect, useState } from "react";

/**
 * Props:
 * - items: [{ _id, name, qty, price }]
 * - totalQty, totalPrice
 * - addresses: [{ _id?, name, phone, address, pincode, label }]
 * - onAddAddress() -> open Add Address modal
 * - onEditAddress(idx) -> open Edit Address modal for idx
 * - onDeleteAddress(idx)
 * - onClose()
 * - onConfirm(addressIdx)
 */
export default function Cart(props) {
  const {
    items = [],
    totalQty = 0,
    totalPrice = 0,
    addresses = [],
    onAddAddress,
    onEditAddress,
    onDeleteAddress,
    onClose,
    onConfirm,
  } = props;

  const [selectedIdx, setSelectedIdx] = useState(addresses.length ? 0 : null);

  useEffect(() => {
    // maintain selection when addresses change
    if (addresses && addresses.length > 0) {
      if (selectedIdx === null || selectedIdx >= addresses.length) setSelectedIdx(0);
    } else {
      setSelectedIdx(null);
    }
  }, [addresses]);

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center pt-12">
      <div className="w-[700px] bg-white rounded shadow-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Cart — {totalQty} items</h3>
          <div>
            <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Close</button>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {items.length === 0 && <div className="text-sm text-gray-500">Cart is empty</div>}
          {items.map(it => (
            <div key={it._id} className="p-3 border rounded flex justify-between items-center">
              <div>
                <div className="font-medium">{it.name}</div>
                <div className="text-sm text-gray-600">Qty: {it.qty} × ₹{it.price}</div>
              </div>
              <div className="font-medium">₹{it.qty * it.price}</div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mb-3">
          <div className="text-sm">Total:</div>
          <div className="text-xl font-semibold">₹{totalPrice}</div>
        </div>

        <div className="mb-3 flex justify-between items-center">
          <h4 className="font-medium">Delivery Address</h4>
          <div>
            <button onClick={onAddAddress} className="px-3 py-1 bg-white border rounded">Add / Edit</button>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {addresses.length === 0 ? (
            <div className="text-sm text-gray-500">No addresses saved</div>
          ) : (
            addresses.map((a, i) => (
              <div key={a._id || i} className={`p-3 border rounded ${selectedIdx === i ? "bg-blue-50" : ""}`}>
                <label className="flex items-start gap-3 w-full">
                  <input
                    type="radio"
                    checked={selectedIdx === i}
                    onChange={() => setSelectedIdx(i)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{a.label || "Home"} {i === 0 ? <span className="text-xs text-blue-600 ml-2">Default</span> : null}</div>
                      <div className="text-sm text-gray-600"> {a.pincode || ""}</div>
                    </div>
                    <div className="text-sm">{a.address}</div>
                    <div className="text-xs text-gray-600 mt-1">{a.name || ""} • {a.phone ? (a.phone.startsWith("+") ? a.phone : `+91${a.phone}`) : ""}</div>
                  </div>
                </label>

                <div className="mt-2 flex gap-2">
                  <button onClick={() => onEditAddress && onEditAddress(i)} className="px-3 py-1 bg-white border rounded">Edit</button>
                  <button onClick={() => onDeleteAddress && onDeleteAddress(i)} className="px-3 py-1 bg-red-50 text-red-600 border rounded">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
          <button
            onClick={() => {
              if (selectedIdx === null) {
                alert("Select or add address first");
                return;
              }
              onConfirm && onConfirm(selectedIdx);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Place Order
          </button>
        </div>
      </div>
    </div>
  );
}

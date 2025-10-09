// frontend/src/components/Cart.jsx
import React, { useState } from "react";

/**
 * Cart component
 *
 * Props (inline mode):
 *  - items: [{ _id, name, price, qty }]
 *  - totalQty, totalPrice
 *  - onIncrement(id), onDecrement(id), onRemove(id)
 *  - onPlaceOrder()  <-- opens checkout/modal from parent
 *  - disabled (boolean) // disables Place Order when shop offline
 *
 * Props (modal mode):
 *  - modal (bool)
 *  - onClose()
 *  - items (array)
 *  - total (number)
 *  - addresses (array of { name, phone, address, pincode })
 *  - onAddAddress()
 *  - onDeleteAddress(idx)
 *  - onSaveAddress(addr)
 *  - onConfirm(addressIdx) => async returns { ok, order? , message? }
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
    total: modalTotal = 0,
    addresses = [],
    onAddAddress = () => {},
    onDeleteAddress = () => {},
    onSaveAddress = () => {},
    onConfirm = async () => ({ ok: false, message: "not implemented" }),
  } = props;

  // modal selection state
  const [selectedAddressIdx, setSelectedAddressIdx] = useState(addresses && addresses.length ? 0 : -1);
  const [confirming, setConfirming] = useState(false);

  // keep selectedAddressIdx in sync when addresses change
  React.useEffect(() => {
    if (!addresses || addresses.length === 0) setSelectedAddressIdx(-1);
    else if (selectedAddressIdx < 0) setSelectedAddressIdx(0);
  }, [addresses, selectedAddressIdx]);

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
            <div className="text-lg font-semibold">Total: ₹{modalTotal || items.reduce((s, i) => s + i.qty * i.price, 0)}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium">Delivery Address</div>
                <div>
                  <button onClick={onAddAddress} className="px-2 py-1 bg-gray-200 rounded text-sm">Add</button>
                </div>
              </div>

              {(!addresses || addresses.length === 0) ? (
                <div className="text-sm text-gray-500">No saved addresses. Add one to continue.</div>
              ) : (
                <div className="space-y-2">
                  {addresses.map((a, idx) => (
                    <label key={idx} className={`block p-3 border rounded cursor-pointer ${selectedAddressIdx === idx ? "ring-2 ring-indigo-300 bg-indigo-50" : ""}`}>
                      <input
                        type="radio"
                        name="cart_address"
                        checked={selectedAddressIdx === idx}
                        onChange={() => setSelectedAddressIdx(idx)}
                        className="mr-2"
                      />
                      <div className="font-medium">{a.name} • +91{(a.phone || "").replace(/\D/g,'')}</div>
                      <div className="text-xs text-gray-600">{a.address}</div>
                      <div className="text-xs text-gray-500">Pincode: {a.pincode}</div>
                      <div className="mt-2 flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); onDeleteAddress(idx); if (selectedAddressIdx === idx) setSelectedAddressIdx(-1); }} className="px-2 py-1 bg-red-400 text-white rounded text-sm">Delete</button>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="font-medium mb-2">Confirm & Place Order</div>
              <div className="text-sm text-gray-600 mb-3">Select an address and click Place Order. If pincode doesn't match shop, you'll be notified.</div>

              <div>
                <button
                  onClick={async () => {
                    if (selectedAddressIdx === -1) {
                      alert("Select or add an address first");
                      return;
                    }
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

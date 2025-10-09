// frontend/src/components/Cart.jsx
import React from "react";

/**
 * Cart component
 * Props:
 * - items: [{ _id, name, price, qty }]
 * - totalQty: number
 * - totalPrice: number
 * - onIncrement(itemId)
 * - onDecrement(itemId)
 * - onRemove(itemId)
 * - onPlaceOrder()
 * - disabled: boolean
 */
export default function Cart({
  items = [],
  totalQty = 0,
  totalPrice = 0,
  onIncrement = () => {},
  onDecrement = () => {},
  onRemove = () => {},
  onPlaceOrder = () => {},
  disabled = false,
}) {
  return (
    <div className="bg-white border rounded p-4 shadow-sm">
      <h4 className="font-medium mb-3">Cart</h4>

      {items.length === 0 ? (
        <div className="text-sm text-gray-600 mb-3">Cart is empty</div>
      ) : (
        <div className="space-y-3 mb-3">
          {items.map((it) => (
            <div key={it._id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{it.name}</div>
                <div className="text-xs text-gray-500">₹{it.price} • {it.qty} ×</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onDecrement(it._id)}
                  className="px-2 py-1 bg-gray-200 rounded"
                  aria-label="decrement"
                >
                  −
                </button>
                <div className="px-3 py-1 border rounded text-sm">{it.qty}</div>
                <button
                  onClick={() => onIncrement(it._id)}
                  className="px-2 py-1 bg-gray-200 rounded"
                  aria-label="increment"
                >
                  +
                </button>
                <button
                  onClick={() => onRemove(it._id)}
                  className="px-3 py-1 bg-red-500 text-white rounded ml-2"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">Items: <b>{totalQty}</b></div>
        <div className="text-sm text-gray-800">Total: <b>₹{totalPrice}</b></div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onPlaceOrder}
          disabled={disabled || items.length === 0}
          className={`px-4 py-2 rounded ${disabled || items.length === 0 ? "bg-gray-300 text-gray-600" : "bg-green-600 text-white"}`}
        >
          {disabled ? "Unavailable" : "Place Order"}
        </button>
      </div>
    </div>
  );
}

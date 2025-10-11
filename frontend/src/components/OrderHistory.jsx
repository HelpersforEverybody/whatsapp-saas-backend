// frontend/src/components/OrderHistory.jsx
import React, { useEffect, useState, useRef } from "react";

/**
 * Props:
 *  - open (bool)
 *  - onClose()
 *  - apiBase (string) optional, default uses /api
 *  - authToken (string) optional; if not provided component will read from localStorage('customer_token')
 *  - onReorder(order) -> callback when user clicks Reorder (order.items provided)
 *
 * Usage:
 *  <OrderHistory open={open} onClose={...} onReorder={handleReorder} />
 */

// normalize status + render colored badge
function StatusBadge({ status }) {
  if (!status) return null;

  // normalize: lower-case, convert spaces or dashes to underscores
  const key = String(status || "").toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");

const map = {
  received:          { label: "received",        className: "bg-gray-200 text-gray-800" },
  pending:           { label: "pending",         className: "bg-gray-200 text-gray-800" },
  accepted:          { label: "accepted",        className: "bg-yellow-100 text-yellow-800" },
  preparing:         { label: "preparing",       className: "bg-yellow-100 text-yellow-800" },
  packed:            { label: "packed",          className: "bg-blue-100 text-blue-800" },
  out_for_delivery:  { label: "out-for-delivery", className: "bg-indigo-100 text-indigo-800" },
  delivered:         { label: "delivered",       className: "bg-green-100 text-green-800" },
  completed:         { label: "delivered",       className: "bg-green-100 text-green-800" },
  cancelled:         { label: "cancelled",       className: "bg-red-100 text-red-800" },
  failed:            { label: "failed",          className: "bg-red-200 text-red-800" },
};


  // allow both dash and underscore styles: map both "out-for-delivery" and "out_for_delivery"
  const altKey = key.replace(/-/g, "_");

  const entry = map[key] || map[altKey] || { label: status, className: "bg-gray-100 text-gray-800" };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded ${entry.className}`}>
      {entry.label.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
    </span>
  );
}

// helper to get canonical total from order object (supports different field names)
function getOrderTotal(order) {
  if (!order) return 0;
  // prefer 'total' (backend), fall back to 'totalPrice', 'amount' etc if some other naming used
  return Number(order.total ?? order.totalPrice ?? order.amount ?? 0);
}

export default function OrderHistory({ open = false, onClose = () => {}, apiBase = "", authToken = "", onReorder = () => {} }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const pollingRef = useRef(null);

  const token = authToken || (typeof window !== "undefined" ? localStorage.getItem("customer_token") : "");

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchOrders(1);
      // start polling every 8s while modal open
      pollingRef.current = setInterval(() => fetchOrders(page), 8000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchOrders(pageToFetch = 1) {
    setLoading(true);
    try {
      const base = apiBase || "";
      const q = `${base}/api/customers/orders?page=${pageToFetch}&limit=${pageSize}`;
      const res = await fetch(q, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        // non-fatal: set empty
        console.error("Failed to load orders", await res.text());
        setOrders([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      // assume data is array; if backend wraps with pagination adapt accordingly
      setOrders(Array.isArray(data) ? data : (data.orders || []));
    } catch (e) {
      console.error("fetchOrders error", e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  function openDetails(order) {
    setSelectedOrder(order);
  }

  function closeDetails() {
    setSelectedOrder(null);
  }

  function handleReorder(order) {
    // send items back to parent to handle adding to current cart
    onReorder(order);
    // optionally close history
    onClose();
  }

  return !open ? null : (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg w-[92%] max-w-3xl p-4 shadow-lg z-[11010]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Your Orders</h3>
          <button onClick={onClose} className="px-2 py-1 rounded bg-gray-100">Close</button>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="text-sm text-gray-600 p-4">No past orders found.</div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
            {orders.map(o => (
              <div key={o._id} className="p-3 border rounded flex justify-between items-start bg-white">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="font-medium">Order #{o.orderNumber ? String(o.orderNumber).padStart(6, "0") : String(o._id).slice(-6)}</div>
                    <div className="text-xs text-gray-500">{(new Date(o.createdAt)).toLocaleString()}</div>
                    <div className="ml-2">
                      <StatusBadge status={o.status} />
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    { (o.items || []).slice(0,3).map(it => `${it.qty}× ${it.name}`).join(", ") } { (o.items && o.items.length > 3) ? ` + ${o.items.length - 3} more` : "" }
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-sm font-semibold">₹{getOrderTotal(o)}</div>
                  <div className="flex gap-2">
                    <button onClick={() => openDetails(o)} className="px-3 py-1 border rounded text-sm">Details</button>
                    <button onClick={() => handleReorder(o)} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Reorder</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* pagination / actions */}
        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">Showing up to {orders.length} recent orders</div>
          <div className="flex gap-2">
            <button onClick={() => { setPage(p => Math.max(1, p-1)); fetchOrders(Math.max(1, page-1)); }} className="px-3 py-1 bg-gray-100 rounded">Prev</button>
            <button onClick={() => { setPage(p => p+1); fetchOrders(page+1); }} className="px-3 py-1 bg-gray-100 rounded">Next</button>
          </div>
        </div>

        {/* Order details drawer/modal */}
        {selectedOrder && (
          <div className="fixed inset-0 z-[11100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={closeDetails} />
            <div className="relative bg-white rounded-lg w-[92%] max-w-2xl p-4 shadow-lg z-[11110]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold">Order #{String(selectedOrder.orderNumber ?? String(selectedOrder._id)).slice(-6)} details</h4>
                <button onClick={closeDetails} className="px-2 py-1 rounded bg-gray-100">Close</button>
              </div>

              <div className="space-y-3">
                <div className="text-sm text-gray-600">Status: <StatusBadge status={selectedOrder.status} /></div>
                <div className="border rounded p-3">
                  <div className="font-medium mb-2">Items</div>
                  <div className="space-y-2">
                    {(selectedOrder.items || []).map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <div className="text-sm">{it.name} <span className="text-xs text-gray-500">×{it.qty}</span></div>
                        <div className="text-sm font-semibold">₹{(Number(it.price||0) * Number(it.qty||1)).toFixed(0)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 border rounded">
                  <div className="text-sm text-gray-600">Delivery</div>
                  <div className="font-medium">{selectedOrder.customerName || ""} • {selectedOrder.phone || ""}</div>
                  <div className="text-sm text-gray-700 mt-1">{selectedOrder.address?.label ? selectedOrder.address.label + " • " : ""}{selectedOrder.address?.address || selectedOrder.address || ""}</div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">Total</div>
                  <div className="text-xl font-semibold">₹{getOrderTotal(selectedOrder)}</div>
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={() => { handleReorder(selectedOrder); }} className="px-3 py-1 bg-green-600 text-white rounded">Reorder</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

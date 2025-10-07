// frontend/src/pages/ShopManager.jsx
import React, { useEffect, useState, useCallback } from "react";
import { getApiBase } from "../hooks/useApi";

export default function ShopManager() {
  const API_BASE = getApiBase();

  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [quantities, setQuantities] = useState({}); // itemId -> qty
  const [cart, setCart] = useState({}); // itemId -> qty
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "" });

  const loadShops = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/shops`);
      if (!res.ok) throw new Error("Failed to load shops");
      const data = await res.json();
      setShops(data);
      if (data.length && !selectedShop) setSelectedShop(data[0]);
    } catch (e) {
      console.error("Load shops error", e);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, selectedShop]);

  const loadMenu = useCallback(async (shopId) => {
    if (!shopId) return setMenu([]);
    try {
      const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
      if (!res.ok) {
        setMenu([]);
        return;
      }
      const data = await res.json();
      setMenu(data);
      // seed quantities
      const q = {};
      data.forEach(it => { q[it._id] = 1; });
      setQuantities(q);
      setCart({});
    } catch (e) {
      console.error("Load menu error", e);
      setMenu([]);
    }
  }, [API_BASE]);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    if (selectedShop && selectedShop._id) loadMenu(selectedShop._id);
    else setMenu([]);
  }, [selectedShop, loadMenu]);

  // Add item to the local cart (not placing order yet)
  function addToCart(item) {
    if (!item.available) return;
    const qty = Number(quantities[item._id] || 1);
    setCart(prev => {
      const copy = { ...prev };
      copy[item._id] = (copy[item._id] || 0) + qty;
      return copy;
    });
    alert(`${item.name} x${qty} added to cart`);
  }

  // Remove item from cart
  function removeFromCart(itemId) {
    setCart(prev => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  }

  function cartItems() {
    return Object.entries(cart).map(([id, qty]) => {
      const it = menu.find(m => String(m._id) === String(id));
      return it ? { _id: id, name: it.name, qty, price: it.price } : null;
    }).filter(Boolean);
  }

  // Place a single order for the selected shop with multiple items
  async function placeOrder() {
    if (!selectedShop) return alert("Select a shop");
    if (!customer.name || !customer.phone) return alert("Enter your name and phone");
    const items = cartItems().filter(it => {
      const m = menu.find(mm => String(mm._id) === String(it._id));
      return m && m.available;
    }).map(it => ({ name: it.name, qty: it.qty, price: it.price }));

    if (!items.length) return alert("No available items in cart");

    const payload = {
      shop: selectedShop._id,
      customerName: customer.name,
      phone: customer.phone,
      items
    };

    try {
      // NOTE: If backend requires an API key for public orders, you must include it.
      // If your backend accepts public orders, the following will work.
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.status);
      }
      const data = await res.json();
      alert("Order placed: " + String(data._id).slice(0,6));
      // clear cart for this shop
      setCart({});
    } catch (e) {
      console.error("Order failed:", e);
      alert("Order failed");
    }
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Shops & Menu</h2>

        <div className="mb-4 p-4 border rounded bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="p-2 border rounded" placeholder="Your Name" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
            <input className="p-2 border rounded" placeholder="Your Phone (+91...)" value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium mb-2">Available Shops</h4>
            {shops.map(s => (
              <div key={s._id} onClick={() => setSelectedShop(s)} className={`p-3 mb-3 border rounded cursor-pointer ${selectedShop && selectedShop._id === s._id ? "bg-blue-50" : ""}`}>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-gray-500">{s.phone}</div>
                <div className="text-sm text-gray-400">{s.description}</div>
              </div>
            ))}
          </div>

          <div className="col-span-2">
            <h4 className="font-medium mb-2">Menu for {selectedShop ? selectedShop.name : "—"}</h4>
            {menu.length === 0 ? <div>No items</div> :
              <div className="space-y-3">
                {menu.map(item => (
                  <div key={item._id} className="p-3 border rounded flex justify-between items-center">
                    <div>
                      <div className="font-medium">{item.name} • ₹{item.price}</div>
                      <div className="text-xs text-gray-500">{item.available ? "Available" : "Unavailable"}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        value={quantities[item._id] || 1}
                        onChange={e => setQuantities(q => ({ ...q, [item._id]: Number(e.target.value) }))}
                        disabled={!item.available}
                        className="w-20 p-1 border rounded"
                      />
                      <button
                        onClick={() => addToCart(item)}
                        disabled={!item.available}
                        className={`px-3 py-2 rounded ${item.available ? "bg-green-600 text-white" : "bg-gray-300 text-gray-700"}`}
                      >
                        {item.available ? "Add" : "Unavailable"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            }

            <div className="mt-6 p-4 border rounded bg-gray-50">
              <h4 className="font-medium">Cart</h4>
              {cartItems().length === 0 ? <div>No items in cart</div> :
                <div className="space-y-2">
                  {cartItems().map(ci => (
                    <div key={ci._id} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <div className="font-medium">{ci.name} x{ci.qty}</div>
                        <div className="text-sm text-gray-500">₹{ci.price * ci.qty}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => removeFromCart(ci._id)} className="px-2 py-1 bg-gray-200 rounded">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              }

              <div className="mt-4">
                <button
                  onClick={placeOrder}
                  disabled={cartItems().length === 0}
                  className={`px-4 py-2 rounded ${cartItems().length === 0 ? "bg-gray-300" : "bg-green-600 text-white"}`}
                >
                  Place Order
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

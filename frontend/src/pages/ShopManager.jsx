import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://whatsapp-saas-backend-f9ot.onrender.com";
const API_KEY = import.meta.env.VITE_API_KEY || "S3cR3t-1234-DoNotShare";

export default function ShopManager() {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [newShop, setNewShop] = useState({ name: "", phone: "", description: "" });
  const [menu, setMenu] = useState([]);
  const [newItem, setNewItem] = useState({ name: "", price: "" });
  const [loading, setLoading] = useState(false);

  // Load all shops
  async function loadShops() {
    const res = await fetch(`${API_BASE}/api/shops`);
    if (res.ok) setShops(await res.json());
  }

  useEffect(() => {
    loadShops();
  }, []);

  // Create shop
  async function createShop(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/shops`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify(newShop),
      });
      if (!res.ok) throw new Error("Failed");
      alert("Shop created!");
      setNewShop({ name: "", phone: "", description: "" });
      loadShops();
    } catch {
      alert("Failed to create shop");
    } finally {
      setLoading(false);
    }
  }

  // Load menu
  async function loadMenu(shopId) {
    const res = await fetch(`${API_BASE}/api/shops/${shopId}/menu`);
    if (res.ok) setMenu(await res.json());
    setSelectedShop(shopId);
  }

  // Add menu item
  async function addItem(e) {
    e.preventDefault();
    if (!selectedShop) return alert("Select a shop first!");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/shops/${selectedShop}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify(newItem),
      });
      if (!res.ok) throw new Error("Failed");
      alert("Item added!");
      setNewItem({ name: "", price: "" });
      loadMenu(selectedShop);
    } catch {
      alert("Failed to add item");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "30px auto", padding: "0 16px" }}>
      <h1>🛍 Shop & Menu Manager</h1>

      {/* Create Shop */}
      <form onSubmit={createShop} style={{ marginTop: 20 }}>
        <h3>Create New Shop</h3>
        <input
          placeholder="Shop name"
          value={newShop.name}
          onChange={(e) => setNewShop({ ...newShop, name: e.target.value })}
          required
          style={{ display: "block", marginBottom: 8 }}
        />
        <input
          placeholder="Phone +91..."
          value={newShop.phone}
          onChange={(e) => setNewShop({ ...newShop, phone: e.target.value })}
          required
          style={{ display: "block", marginBottom: 8 }}
        />
        <input
          placeholder="Description"
          value={newShop.description}
          onChange={(e) => setNewShop({ ...newShop, description: e.target.value })}
          style={{ display: "block", marginBottom: 8 }}
        />
        <button disabled={loading}>Create Shop</button>
      </form>

      {/* Existing Shops */}
      <div style={{ marginTop: 30 }}>
        <h3>Existing Shops</h3>
        {shops.length === 0 ? (
          <div>No shops yet</div>
        ) : (
          shops.map((s) => (
            <div
              key={s._id}
              style={{
                padding: 8,
                border: "1px solid #ddd",
                borderRadius: 6,
                marginBottom: 6,
              }}
            >
              <b>{s.name}</b> — {s.phone}
              <button
                onClick={() => loadMenu(s._id)}
                style={{ marginLeft: 10 }}
              >
                View Menu
              </button>
            </div>
          ))
        )}
      </div>

      {/* Menu Section */}
      {selectedShop && (
        <div style={{ marginTop: 30 }}>
          <h3>Menu Items</h3>

          <form onSubmit={addItem}>
            <input
              placeholder="Item name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              required
              style={{ marginRight: 8 }}
            />
            <input
              type="number"
              placeholder="Price"
              value={newItem.price}
              onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
              required
              style={{ marginRight: 8 }}
            />
            <button disabled={loading}>Add Item</button>
          </form>

          <div style={{ marginTop: 20 }}>
            {menu.length === 0 ? (
              <div>No menu items yet</div>
            ) : (
              <ul>
                {menu.map((m) => (
                  <li key={m._id}>
                    {m.name} — ₹{m.price} — <code>{m.externalId}</code>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

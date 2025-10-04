import React, { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  headers["Content-Type"] = "application/json";
  headers["x-api-key"] = API_KEY;
  const res = await fetch(API_URL + path, { ...opts, headers });
  return res;
}

export default function App() {
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    itemsJson: '[{"name":"Pizza","qty":1,"price":150}]',
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api("/api/orders");
    if (res.ok) setOrders(await res.json());
  }

  async function createOrder(e) {
    e.preventDefault();
    let items;
    try {
      items = JSON.parse(form.itemsJson);
    } catch {
      return alert("Invalid items JSON");
    }
    const res = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        customerName: form.customerName,
        phone: form.phone,
        items,
      }),
    });
    if (res.ok) {
      alert("Order created!");
      setForm({ ...form, customerName: "", phone: "" });
      load();
    } else {
      alert("Failed to create order");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto bg-white shadow-lg rounded-xl p-6">
        <h1 className="text-2xl font-semibold mb-4 text-center text-blue-600">
          Merchant Dashboard
        </h1>

        <form onSubmit={createOrder} className="space-y-3">
          <input
            className="border border-gray-300 rounded p-2 w-full"
            placeholder="Customer name"
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            required
          />
          <input
            className="border border-gray-300 rounded p-2 w-full"
            placeholder="Phone +919..."
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
          <textarea
            className="border border-gray-300 rounded p-2 w-full"
            rows="3"
            value={form.itemsJson}
            onChange={(e) => setForm({ ...form, itemsJson: e.target.value })}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            Create Order
          </button>
        </form>

        <h2 className="text-lg font-medium mt-8 mb-2 text-gray-700">
          Recent Orders
        </h2>
        <button
          onClick={load}
          className="mb-4 bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
        >
          Refresh
        </button>
        <pre className="bg-gray-50 text-sm border rounded p-3 max-h-64 overflow-auto">
          {JSON.stringify(orders, null, 2)}
        </pre>
      </div>
    </div>
  );
}

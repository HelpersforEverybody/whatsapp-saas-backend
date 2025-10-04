import React, { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "";
const API_KEY = import.meta.env.VITE_API_KEY || "";

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  headers["Content-Type"] = "application/json";
  headers["x-api-key"] = API_KEY;
  const res = await fetch(API_URL + path, { ...opts, headers });
  return res;
}

export default function App() {
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ customerName: "", phone: "", itemsJson: '[{"name":"Item","qty":1,"price":100}]' });

  useEffect(() => { load(); }, []);

  async function load() {
    const r = await api("/api/orders");
    if (r.ok) {
      setOrders(await r.json());
    } else {
      console.error("Failed to load orders", r.status);
    }
  }

  async function createOrder(e) {
    e.preventDefault();
    let items;
    try { items = JSON.parse(form.itemsJson); } catch { return alert("Invalid items JSON"); }
    const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customerName: form.customerName, phone: form.phone, items }) });
    if (r.ok) { alert("Created"); setForm({ ...form, customerName: "", phone: "" }); load(); }
    else alert("Create failed: " + r.status);
  }

  return (
    <div style={{maxWidth:900, margin:"20px auto", fontFamily:"sans-serif"}}>
      <h1>Merchant Dashboard</h1>
      <form onSubmit={createOrder}>
        <input placeholder="Customer name" value={form.customerName} onChange={e=>setForm({...form, customerName:e.target.value})} required/>
        <input placeholder="Phone +919..." value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} required/>
        <textarea rows="3" value={form.itemsJson} onChange={e=>setForm({...form, itemsJson:e.target.value})} />
        <button type="submit">Create Order</button>
      </form>

      <h2>Orders</h2>
      <button onClick={load}>Refresh</button>
      <pre>{JSON.stringify(orders, null, 2)}</pre>
    </div>
  );
}

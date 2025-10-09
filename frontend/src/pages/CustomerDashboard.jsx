// frontend/src/pages/CustomerDashboard.jsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../hooks/useApi";
import { useNavigate, useLocation } from "react-router-dom";

export default function CustomerDashboard() {
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("profile"); // profile | addresses | orders
  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "", address: "", pincode: "", phone: "" });
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadProfile();
    loadAddresses();
    loadOrders();
    // if redirected after placing an order with ?orderId=..., show orders tab
    const search = new URLSearchParams(location.search);
    if (search.get("orderId")) setActiveTab("orders");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile() {
    try {
      const res = await apiFetch("/api/customers/me");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setProfile(data);
      // store small name/phone for header badge use
      localStorage.setItem("customer_name", data.name || "");
      localStorage.setItem("customer_phone", data.phone || "");
    } catch (e) {
      console.error("loadProfile", e);
      setMsg("Failed to load profile (please login again)");
    }
  }

  async function loadAddresses() {
    try {
      const res = await apiFetch("/api/customers/addresses");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setAddresses(data || []);
    } catch (e) {
      console.error("loadAddresses", e);
    }
  }

  async function loadOrders() {
    try {
      const res = await apiFetch("/api/customers/orders");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setOrders(data || []);
    } catch (e) {
      console.error("loadOrders", e);
    }
  }

  async function saveNewAddress() {
    try {
      if (!newAddr.address || !/^\d{6}$/.test(newAddr.pincode || "")) return setMsg("Address and 6-digit pincode required");
      const res = await apiFetch("/api/customers/addresses", { method: "POST", body: JSON.stringify(newAddr) });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "failed");
      }
      await loadAddresses();
      setAddrModalOpen(false);
      setNewAddr({ label: "", address: "", pincode: "", phone: "" });
    } catch (e) {
      console.error("save addr", e);
      setMsg("Failed to add address");
    }
  }

  async function deleteAddress(id) {
    if (!confirm("Delete this address?")) return;
    try {
      const res = await apiFetch(`/api/customers/addresses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      await loadAddresses();
    } catch (e) {
      console.error("delete", e);
      setMsg("Failed to delete");
    }
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Your Profile</h2>
          <div>
            <button onClick={() => { localStorage.removeItem("customer_token"); localStorage.removeItem("customer_name"); localStorage.removeItem("customer_phone"); navigate("/shops"); }} className="px-3 py-1 bg-gray-200 rounded">Logout</button>
          </div>
        </div>

        {msg && <div className="text-sm text-red-600 mb-3">{msg}</div>}

        <div className="mb-4">
          <button onClick={() => setActiveTab("profile")} className={`px-3 py-1 rounded mr-2 ${activeTab === "profile" ? "bg-black text-white" : "bg-gray-200"}`}>Profile</button>
          <button onClick={() => setActiveTab("addresses")} className={`px-3 py-1 rounded mr-2 ${activeTab === "addresses" ? "bg-black text-white" : "bg-gray-200"}`}>Addresses</button>
          <button onClick={() => setActiveTab("orders")} className={`px-3 py-1 rounded ${activeTab === "orders" ? "bg-black text-white" : "bg-gray-200"}`}>Orders</button>
        </div>

        {activeTab === "profile" && (
          <div>
            <div className="mb-3">
              <div className="text-sm text-gray-600">Name</div>
              <div className="font-medium">{profile ? profile.name : "—"}</div>
            </div>
            <div className="mb-3">
              <div className="text-sm text-gray-600">Phone</div>
              <div className="font-medium">{profile ? profile.phone : "—"}</div>
            </div>
            <div>
              <button onClick={() => {
                const newName = prompt("New name", profile ? profile.name : "");
                if (!newName) return;
                apiFetch("/api/customers/me", { method: "PATCH", body: JSON.stringify({ name: newName }) })
                  .then(r => { if (!r.ok) return r.text().then(t => Promise.reject(t)); return r.json(); })
                  .then(() => loadProfile())
                  .catch(e => alert("Update failed"));
              }} className="px-3 py-1 bg-gray-200 rounded">Edit Name</button>
            </div>
          </div>
        )}

        {activeTab === "addresses" && (
          <div>
            <div className="mb-3 flex justify-between items-center">
              <div className="text-sm text-gray-600">Manage delivery addresses</div>
              <button onClick={() => setAddrModalOpen(true)} className="px-3 py-1 bg-blue-600 text-white rounded">Add address</button>
            </div>
            {addresses.length === 0 ? (
              <div>No addresses</div>
            ) : (
              <div className="space-y-3">
                {addresses.map(a => (
                  <div key={a._id} className="p-3 border rounded flex justify-between">
                    <div>
                      <div className="font-medium">{a.label || "Address"}</div>
                      <div className="text-sm text-gray-600">{a.address} • {a.pincode}</div>
                      <div className="text-xs text-gray-500">{a.phone}</div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <button onClick={() => {
                        const label = prompt("Label", a.label || "");
                        const address = prompt("Address", a.address || "");
                        const pincode = prompt("Pincode (6 digits)", a.pincode || "");
                        if (!address || !/^\d{6}$/.test(pincode || "")) return alert("Invalid");
                        apiFetch(`/api/customers/addresses/${a._id}`, { method: "PATCH", body: JSON.stringify({ label, address, pincode }) })
                          .then(r => { if (!r.ok) return r.text().then(t => Promise.reject(t)); return r.json(); })
                          .then(() => loadAddresses())
                          .catch(e => alert("Update failed"));
                      }} className="px-3 py-1 bg-gray-200 rounded">Edit</button>
                      <button onClick={() => deleteAddress(a._id)} className="px-3 py-1 bg-red-600 text-white rounded">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "orders" && (
          <div>
            {orders.length === 0 ? <div>No orders</div> : (
              <div className="space-y-3">
                {orders.map(o => (
                  <div key={o._id} className="p-3 border rounded">
                    <div className="flex justify-between items-center">
                      <div className="font-medium">{o.orderNumber ? `#${String(o.orderNumber).padStart(6,'0')}` : o._id.slice(0,8)}</div>
                      <div className="text-sm text-gray-600">{new Date(o.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-sm text-gray-600">Status: <b>{o.status}</b></div>
                    <div className="text-sm">Total: ₹{o.total}</div>
                    <div className="text-xs text-gray-600 mt-1">{o.items.map(i => `${i.name} x${i.qty}`).join(", ")}</div>
                    <div className="mt-2">
                      <button onClick={() => navigate(`/profile?orderId=${o._id}`)} className="px-3 py-1 bg-gray-200 rounded">View</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Address modal */}
      {addrModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white p-4 rounded w-[520px]">
            <h3 className="font-semibold mb-2">Add address</h3>
            <input value={newAddr.label} onChange={e => setNewAddr(prev => ({ ...prev, label: e.target.value }))} placeholder="Label (Home / Work)" className="p-2 border rounded w-full mb-2" />
            <textarea value={newAddr.address} onChange={e => setNewAddr(prev => ({ ...prev, address: e.target.value }))} placeholder="Full address" className="p-2 border rounded w-full mb-2" />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input value={newAddr.pincode} onChange={e => setNewAddr(prev => ({ ...prev, pincode: e.target.value.replace(/\D/g,'').slice(0,6) }))} placeholder="Pincode (6 digits)" className="p-2 border rounded" />
              <input value={newAddr.phone} onChange={e => setNewAddr(prev => ({ ...prev, phone: e.target.value.replace(/\D/g,'').slice(0,15) }))} placeholder="Phone (optional)" className="p-2 border rounded" />
            </div>
            {msg && <div className="text-sm text-red-600 mb-2">{msg}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setAddrModalOpen(false)} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
              <button onClick={saveNewAddress} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

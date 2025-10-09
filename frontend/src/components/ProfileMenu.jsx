// frontend/src/components/ProfileMenu.jsx
import React, { useEffect, useState } from "react";
import { getApiBase } from "../hooks/useApi";

const API_BASE = getApiBase();

export default function ProfileMenu({ name = "", phone = "", onLogout = () => {}, onOpenAddressModal = () => {} }) {
  const [open, setOpen] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem("customer_token") || "";

  useEffect(() => {
    if (open) loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadAddresses() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers/addresses`, { headers: { Authorization: `Bearer ${token}` }});
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setAddresses(data || []);
    } catch (e) {
      console.error("load addresses", e);
    } finally {
      setLoading(false);
    }
  }

  async function setDefault(addrId) {
    try {
      const res = await fetch(`${API_BASE}/api/customers/addresses/${addrId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isDefault: true })
      });
      if (!res.ok) throw new Error("failed");
      loadAddresses();
    } catch (e) {
      console.error("set default", e);
      alert("Failed to set default");
    }
  }

  async function deleteAddr(addrId, isDefault) {
    if (isDefault) {
      alert("You must set another address as default before deleting this default address.");
      return;
    }
    if (!confirm("Delete this address?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/customers/addresses/${addrId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "failed");
      }
      loadAddresses();
    } catch (e) {
      console.error("delete address", e);
      alert("Failed to delete address");
    }
  }

  function openManage() {
    setOpen(true);
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} className="px-3 py-1 border rounded flex items-center gap-2">
        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-sm">U</div>
        <div className="text-sm">{phone || name || "Login"}</div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border rounded shadow z-50">
          <div className="p-3 border-b">
            <div className="font-medium">{name || "Customer"}</div>
            <div className="text-xs text-gray-600">{phone}</div>
          </div>

          <div className="p-2">
            <button onClick={openManage} className="w-full text-left px-2 py-2 rounded hover:bg-gray-50">Manage Addresses</button>
            <button onClick={() => { setOpen(false); onLogout(); }} className="w-full text-left px-2 py-2 rounded text-red-600">Logout</button>
          </div>
        </div>
      )}

      {/* Manage addresses modal */}
      {open && <ManageAddressesModal open={open} onClose={() => setOpen(false)} addresses={addresses}
        loading={loading} onRefresh={loadAddresses} onEdit={() => onOpenAddressModal()} onSetDefault={setDefault} onDelete={deleteAddr} />}
    </div>
  );
}

function ManageAddressesModal({ open, onClose, addresses = [], loading, onRefresh, onEdit, onSetDefault, onDelete }) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded p-4 w-[560px] max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Addresses</h3>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Close</button>
            <button onClick={() => { onEdit(null); }} className="px-3 py-1 bg-blue-600 text-white rounded">Add New</button>
          </div>
        </div>

        {loading ? <div>Loading...</div> : addresses.length === 0 ? <div>No addresses saved</div> :
          addresses.map((a) => (
            <div key={a._id} className="p-3 border rounded mb-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{a.name || a.label || "Unnamed" } {a.isDefault ? <span className="text-xs bg-green-100 px-2 py-0.5 rounded ml-2">Default</span> : null}</div>
                  <div className="text-sm text-gray-700">{a.address}</div>
                  <div className="text-xs text-gray-500 mt-1">{a.phone} • {a.pincode}</div>
                </div>
                <div className="flex flex-col gap-2">
                  {!a.isDefault && <button onClick={() => onSetDefault(a._id)} className="px-2 py-1 bg-gray-100 rounded text-sm">Set default</button>}
                  <button onClick={() => onEdit(a)} className="px-2 py-1 bg-gray-100 rounded text-sm">Edit</button>
                  <button onClick={() => onDelete(a._id, a.isDefault)} className="px-2 py-1 bg-red-100 rounded text-sm text-red-600">Delete</button>
                </div>
              </div>
            </div>
          ))
        }

      </div>
    </div>
  );
}

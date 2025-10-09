// frontend/src/components/ProfileMenu.jsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getApiBase } from "../hooks/useApi";
import { Home, Briefcase, MapPin, Plus, Edit, Trash2, Star } from "lucide-react";

const API_BASE = getApiBase();

export default function ProfileMenu({
  name = "",
  phone = "",
  onLogout = () => {},
  onAddressesUpdated = null, // optional callback to notify parent
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <div className="relative">
      {/* Profile Button */}
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="px-3 py-1 border rounded flex items-center gap-2 bg-white"
      >
        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-sm">
          {name?.[0]?.toUpperCase() || "U"}
        </div>
        <div className="text-sm">{phone || name || "Login"}</div>
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow z-[120]">
          <div className="p-3 border-b">
            <div className="font-medium">{name || "Customer"}</div>
            <div className="text-xs text-gray-600">{phone}</div>
          </div>
          <div className="p-2">
            <button
              onClick={() => {
                setManageOpen(true);
                setMenuOpen(false);
              }}
              className="w-full text-left px-2 py-2 rounded hover:bg-gray-50"
            >
              Manage Addresses
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              className="w-full text-left px-2 py-2 rounded text-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Manage Addresses Modal */}
      {manageOpen && (
        <ManageAddresses
          onClose={() => setManageOpen(false)}
          onAddressesUpdated={onAddressesUpdated}
        />
      )}
    </div>
  );
}

/* ----------------------
   Manage Addresses
   ---------------------- */
function ManageAddresses({ onClose, onAddressesUpdated = null }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addEditOpen, setAddEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const token = localStorage.getItem("customer_token") || "";

  useEffect(() => {
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAddresses() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error("addresses fetch failed", await res.text());
        setAddresses([]);
        return;
      }
      const data = await res.json();
      // mark first as default if none present (UI-only fallback)
      const hasDefault = Array.isArray(data) && data.some((a) => a.isDefault);
      const normalized = (data || []).map((a, idx) => ({
        ...a,
        isDefault: !!a.isDefault || (!hasDefault && idx === 0),
      }));
      setAddresses(normalized);
      if (typeof onAddressesUpdated === "function") onAddressesUpdated(normalized);
    } catch (e) {
      console.error("load addresses error", e);
    } finally {
      setLoading(false);
    }
  }

  // ask backend to mark default (best-effort; if backend doesn't support it we still refresh)
  async function setDefault(addrId) {
    try {
      await fetch(`${API_BASE}/api/customers/addresses/${addrId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // backend may expect e.g. { isDefault: true } or reorder; we send isDefault flag
        body: JSON.stringify({ isDefault: true }),
      });
    } catch (e) {
      console.error("setDefault error", e);
    } finally {
      await loadAddresses();
    }
  }

  async function deleteAddr(addrId, isDefault) {
    if (isDefault) {
      alert("Cannot delete default address. Set another address as default first.");
      return;
    }
    if (!confirm("Delete this address?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/customers/addresses/${addrId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAddresses();
    } catch (e) {
      console.error("deleteAddr error", e);
      alert("Failed to delete address.");
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-[560px] max-h-[80vh] overflow-auto p-5 relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Addresses</h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditData(null);
                setAddEditOpen(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm"
            >
              <Plus size={14} /> Add New
            </button>
            <button onClick={onClose} className="px-3 py-1.5 bg-gray-200 rounded text-sm">
              Close
            </button>
          </div>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : addresses.length === 0 ? (
          <div className="text-gray-500">No addresses saved</div>
        ) : (
          <div className="space-y-3">
            {addresses.map((a) => (
              <div
                key={a._id}
                className={`p-3 border rounded-lg ${a.isDefault ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {a.label === "Office" ? <Briefcase size={18} /> : a.label === "Other" ? <MapPin size={18} /> : <Home size={18} />}
                      {a.label || "Home"}{" "}
                      {a.isDefault && (
                        <span className="text-xs text-blue-600 flex items-center gap-1 ml-2">
                          <Star size={12} /> Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm mt-1">{a.address}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {a.name} • {a.phone} • {a.pincode}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    {!a.isDefault && (
                      <button onClick={() => setDefault(a._id)} className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditData(a);
                        setAddEditOpen(true);
                      }}
                      className="text-xs flex items-center gap-1 bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      <Edit size={14} /> Edit
                    </button>
                    <button
                      onClick={() => deleteAddr(a._id, a.isDefault)}
                      disabled={a.isDefault}
                      className={`text-xs flex items-center gap-1 px-2 py-1 rounded ${a.isDefault ? "bg-gray-100 text-gray-400" : "bg-red-100 text-red-600 hover:bg-red-200"}`}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {addEditOpen && (
        <AddEditAddressModal
          onClose={() => {
            setAddEditOpen(false);
            setEditData(null);
          }}
          editData={editData}
          onSaved={async () => {
            await loadAddresses();
            // also notify parent
            if (typeof onAddressesUpdated === "function") onAddressesUpdated && onAddressesUpdated(addresses);
          }}
        />
      )}
    </div>,
    document.body
  );
}

/* ----------------------
   Add / Edit Address Modal (portal -> top)
   ---------------------- */
function AddEditAddressModal({ onClose, editData = null, onSaved = null }) {
  const isEdit = Boolean(editData);
  const [form, setForm] = useState(() => ({
    label: (editData && editData.label) || "Home",
    name: (editData && editData.name) || "",
    phone: (editData && (String(editData.phone || "").replace(/\D/g, "").slice(-10))) || "",
    address: (editData && editData.address) || "",
    pincode: (editData && editData.pincode) || "",
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const token = localStorage.getItem("customer_token") || "";

  useEffect(() => {
    setErr("");
  }, [form]);

  function handlePhoneChange(v) {
    const digits = String(v || "").replace(/\D/g, "").slice(0, 10);
    setForm((f) => ({ ...f, phone: digits }));
  }

  function validate() {
    if (!form.name || String(form.name).trim().length < 2) return "Receiver name required (min 2 chars)";
    const pd = String(form.phone || "").replace(/\D/g, "");
    if (pd.length !== 10) return "Phone must be 10 digits (no +91 in input)";
    if (!form.address || form.address.trim().length < 5) return "Address required (min 5 chars)";
    if (!/^\d{6}$/.test(String(form.pincode || "").trim())) return "Pincode must be 6 digits";
    return null;
  }

  async function handleSave() {
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setSaving(true);
    try {
      const body = {
        label: form.label,
        name: form.name.trim(),
        phone: form.phone, // server will normalize to +91...
        address: form.address.trim(),
        pincode: String(form.pincode).trim(),
      };

      const url = isEdit ? `${API_BASE}/api/customers/addresses/${editData._id}` : `${API_BASE}/api/customers/addresses`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Save failed");
      }

      if (typeof onSaved === "function") await onSaved();
      onClose();
    } catch (e) {
      console.error("save address error", e);
      setErr(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // render modal through portal so it appears above other modals (cart etc.)
  return createPortal(
    <div className="fixed inset-0 z-[220] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-[520px] p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">{isEdit ? "Edit Address" : "Add Address"}</h3>
          <button onClick={onClose} className="text-gray-600">✕</button>
        </div>

        <div className="flex gap-2 mb-3">
          {["Home", "Office", "Other"].map((t) => (
            <button
              key={t}
              onClick={() => setForm((f) => ({ ...f, label: t }))}
              className={`flex items-center gap-1 px-3 py-1 border rounded-full text-sm ${form.label === t ? "bg-blue-100 border-blue-400" : "border-gray-200"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <input placeholder="Receiver’s name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="border rounded w-full p-2" />
          <div className="flex items-center border rounded overflow-hidden">
            <span className="px-3 py-2 bg-gray-100 select-none">+91</span>
            <input placeholder="Phone (10 digits)*" value={form.phone} onChange={(e) => handlePhoneChange(e.target.value)} className="p-2 flex-1 outline-none" maxLength={10} />
          </div>
          <textarea placeholder="Complete address *" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="border rounded w-full p-2 h-24" />
          <input placeholder="Pincode *" value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} className="border rounded w-full p-2" />
        </div>

        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-1 bg-blue-600 text-white rounded">{saving ? "Saving..." : "Save Address"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// frontend/src/components/ProfileMenu.jsx
import React, { useEffect, useState } from "react";
import { getApiBase } from "../hooks/useApi";
import { Home, Briefcase, MapPin, Plus, Edit, Trash2, Star } from "lucide-react";

const API_BASE = getApiBase();

export default function ProfileMenu({ name = "", phone = "", onLogout = () => {}, onOpenAddressModal = () => {} }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <div className="relative">
      {/* Profile Button */}
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="px-3 py-1 border rounded flex items-center gap-2"
      >
        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-sm">
          {name?.[0]?.toUpperCase() || "U"}
        </div>
        <div className="text-sm">{phone || name || "Login"}</div>
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow z-50">
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
      {manageOpen && <ManageAddresses onClose={() => setManageOpen(false)} onOpenAddressModal={onOpenAddressModal} />}
    </div>
  );
}

// ----------------------
// Manage Addresses Modal
// ----------------------
function ManageAddresses({ onClose, onOpenAddressModal }) {
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
        console.error("Failed loading addresses", await res.text());
        setAddresses([]);
      } else {
        const data = await res.json();
        setAddresses(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("load addresses error", e);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }

  async function setDefault(addrId) {
    try {
      const res = await fetch(`${API_BASE}/api/customers/addresses/${addrId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "failed");
      }
      await loadAddresses();
    } catch (e) {
      console.error("setDefault error", e);
      alert("Failed to set default address");
    }
  }

  async function deleteAddr(addrId, isDefault) {
    if (isDefault) {
      alert("Cannot delete default address. Set another address as default first.");
      return;
    }
    if (!window.confirm("Delete this address?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/customers/addresses/${addrId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "failed");
      }
      await loadAddresses();
    } catch (e) {
      console.error("deleteAddr error", e);
      alert("Failed to delete address");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
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
              <Plus size={16} /> Add New
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-200 rounded text-sm"
            >
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
                      {a.label === "Office" ? (
                        <Briefcase size={18} />
                      ) : a.label === "Other" ? (
                        <MapPin size={18} />
                      ) : (
                        <Home size={18} />
                      )}
                      {a.label || "Home"}{" "}
                      {a.isDefault && (
                        <span className="text-xs text-blue-600 flex items-center gap-1 ml-2">
                          <Star size={12} /> Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm mt-1">{a.address}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {a.name || ""} • {a.phone || ""} • {a.pincode || ""}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    {!a.isDefault && (
                      <button
                        onClick={() => setDefault(a._id)}
                        className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                      >
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
                      className="text-xs flex items-center gap-1 bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200"
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
            // If user added a new address and caller wants to open the cart address picker, the parent can do so via prop.
            if (typeof onOpenAddressModal === "function") {
              // no-op here; parent can optionally pass a handler
            }
          }}
        />
      )}
    </div>
  );
}

// ----------------------
// Add / Edit Address Modal
// ----------------------
function AddEditAddressModal({ onClose, editData, onSaved }) {
  const [form, setForm] = useState(
    editData || { label: "Home", name: "", phone: "", address: "", pincode: "" }
  );
  const token = localStorage.getItem("customer_token") || "";
  const isEdit = !!editData;
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editData || { label: "Home", name: "", phone: "", address: "", pincode: "" });
  }, [editData]);

  function setPhoneDigits(v) {
    // keep only digits, max 10
    const digits = String(v || "").replace(/\D/g, "").slice(0, 10);
    setForm((f) => ({ ...f, phone: digits }));
  }

  function validateForm() {
    if (!form.name || String(form.name).trim().length < 2) return "Receiver name required";
    const digits = String(form.phone || "").replace(/\D/g, "");
    if (digits.length !== 10) return "Phone must be 10 digits";
    if (!form.address || String(form.address).trim().length < 5) return "Complete address required";
    if (!/^\d{6}$/.test(String(form.pincode || "").trim())) return "Pincode must be 6 digits";
    return null;
  }

  async function handleSave() {
    const err = validateForm();
    if (err) {
      alert(err);
      return;
    }
    setSaving(true);

    // Normalize phone to +91XXXXXXXXXX for server
    const phoneNorm = String(form.phone).replace(/\D/g, "");
    const payload = {
      label: form.label || "Home",
      name: String(form.name || "").trim(),
      phone: phoneNorm ? `+91${phoneNorm}` : "",
      address: String(form.address || "").trim(),
      pincode: String(form.pincode || "").trim(),
    };

    try {
      const url = isEdit
        ? `${API_BASE}/api/customers/addresses/${editData._id}`
        : `${API_BASE}/api/customers/addresses`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("save address failed", txt);
        alert("Error saving address: " + txt);
        setSaving(false);
        return;
      }

      await onSaved?.();
      onClose();
    } catch (e) {
      console.error("handleSave error", e);
      alert("Error saving address");
    } finally {
      setSaving(false);
    }
  }

  // center modal with high z-index so it overlays cart
  return (
    <div className="fixed inset-0 z-70 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-[520px] p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{isEdit ? "Edit Address" : "Add New Address"}</h3>
          <button onClick={onClose} className="text-gray-600">✕</button>
        </div>

        <div className="flex gap-2 mb-4">
          {["Home", "Office", "Other"].map((t) => (
            <button
              key={t}
              onClick={() => setForm({ ...form, label: t })}
              className={`flex items-center gap-1 px-3 py-1 border rounded-full text-sm ${form.label === t ? "bg-blue-100 border-blue-400" : "border-gray-200"}`}
            >
              {t === "Home" && <Home size={14} />}
              {t === "Office" && <Briefcase size={14} />}
              {t === "Other" && <MapPin size={14} />}
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <input
            placeholder="Receiver’s name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border rounded w-full p-2"
          />
          <input
            placeholder="Phone (10 digits)"
            value={form.phone}
            onChange={(e) => setPhoneDigits(e.target.value)}
            className="border rounded w-full p-2"
          />
          <textarea
            placeholder="Complete address *"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="border rounded w-full p-2 h-24"
          />
          <input
            placeholder="Pincode *"
            value={form.pincode}
            onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            className="border rounded w-full p-2"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="ml-auto bg-blue-600 text-white px-4 py-2 rounded">
            {saving ? "Saving..." : "Save Address"}
          </button>
        </div>
      </div>
    </div>
  );
}

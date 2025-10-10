// frontend/src/components/ProfileMenu.jsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getApiBase } from "../hooks/useApi";
import { Home, Briefcase, MapPin, Plus, Edit, Trash2, Star } from "lucide-react";

const API_BASE = getApiBase();

export default function ProfileMenu({ name = "", phone = "", onLogout = () => {} }) {
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
      {manageOpen && <ManageAddresses onClose={() => setManageOpen(false)} />}
    </div>
  );
}

// ----------------------
// Manage Addresses Modal
// ----------------------
function ManageAddresses({ onClose }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addEditOpen, setAddEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const token = localStorage.getItem("customer_token") || "";

  useEffect(() => {
    loadAddresses();
  }, []);

  async function loadAddresses() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAddresses(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("load addresses error", e);
    } finally {
      setLoading(false);
    }
  }

  async function setDefault(addrId) {
    await fetch(`${API_BASE}/api/customers/addresses/${addrId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isDefault: true }),
    });
    loadAddresses();
  }

  async function deleteAddr(addrId, isDefault) {
    if (isDefault) {
      alert("Cannot delete default address. Set another address as default first.");
      return;
    }
    if (!confirm("Delete this address?")) return;
    await fetch(`${API_BASE}/api/customers/addresses/${addrId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    loadAddresses();
  }

  return (
    // Manage addresses container: note the relative wrapper and the internal portal mount point.
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-[500px] max-h-[80vh] overflow-auto p-5 relative">
        {/* Portal mount point for Add/Edit modal when opened from this ManageAddresses component */}
        <div id="profile-address-portal" />

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Addresses</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setAddEditOpen(true)}
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
                className={`p-3 border rounded-lg ${
                  a.isDefault ? "border-blue-400 bg-blue-50" : "border-gray-200"
                }`}
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
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <Star size={12} /> Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm mt-1">{a.address}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {a.name} • {normalizePhone(a.phone)} • {a.pincode}
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

      {/* Render Add/Edit modal via portal; if #profile-address-portal exists, mount there so modal overlays inside the manage box.
          Otherwise mount to document.body (fallback). */}
      {addEditOpen && (
        <AddEditAddressModal
          onClose={() => {
            setAddEditOpen(false);
            setEditData(null);
            // reload after close to reflect updates
            loadAddresses();
          }}
          editData={editData}
          onSaved={loadAddresses}
        />
      )}
    </div>
  );
}

// ----------------------
// Add / Edit Address Modal
// ----------------------
function AddEditAddressModal({ onClose, editData, onSaved }) {
  // strip +91 if present in edit data before populating
  const stripPhone = (p) => String(p || "").replace(/\D/g, "").slice(-10);

  const [form, setForm] = useState(
    editData
      ? { ...editData, phone: stripPhone(editData.phone) }
      : { label: "Home", name: "", phone: "", address: "", pincode: "" }
  );

  const token = localStorage.getItem("customer_token") || "";
  const isEdit = !!editData;

  async function handleSave() {
    if (!form.name || !form.address || !form.pincode) {
      alert("Please fill all required fields.");
      return;
    }

    // always store +91 prefixed number (backend expects full)
    const digits = (form.phone || "").replace(/\D/g, "").slice(-10);
    const phone = digits ? `+91${digits}` : "";

    const body = {
      label: form.label,
      name: form.name,
      phone,
      address: form.address,
      pincode: form.pincode,
    };

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
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      alert("Error saving address.");
      return;
    }

    onSaved();
    onClose();
  }

  // Determine portal target: prefer profile-address-portal (inside ManageAddresses), otherwise document.body
  const portalTarget = (typeof document !== "undefined") ? document.getElementById("profile-address-portal") : null;
  const isInProfilePortal = !!portalTarget;

  const modal = (
    // overlay: absolute when inside manage box so it sits within the modal; fixed when fallbacking to body.
    <div
      className={`${isInProfilePortal ? "absolute inset-0 z-[10001] flex items-center justify-center" : "fixed inset-0 z-[10001] bg-black/40 flex items-end justify-center"}`}
      onClick={() => { onClose(); }}
      style={isInProfilePortal ? { background: "rgba(0,0,0,0.25)" } : undefined}
    >
      <div
        className={`bg-white rounded-t-2xl w-full max-w-[500px] p-5 shadow-lg ${isInProfilePortal ? "relative" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">{isEdit ? "Edit Address" : "Add New Address"}</h3>
          <button onClick={onClose} className="text-gray-600">✕</button>
        </div>

        <div className="flex gap-2 mb-3">
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
            onChange={(e) =>
              setForm({
                ...form,
                phone: e.target.value.replace(/\D/g, "").slice(0, 10),
              })
            }
            className="border rounded w-full p-2"
          />
          <textarea
            placeholder="Complete address *"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="border rounded w-full p-2 h-20"
          />
          <input
            placeholder="Pincode *"
            value={form.pincode}
            onChange={(e) =>
              setForm({
                ...form,
                pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
              })
            }
            className="border rounded w-full p-2"
          />
        </div>

        <button
          onClick={handleSave}
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded font-medium"
        >
          Save Address
        </button>
      </div>
    </div>
  );

  return createPortal(modal, portalTarget || document.body);
}

// ----------------------
// Helpers
// ----------------------
function normalizePhone(p) {
  if (!p) return "";
  const digits = String(p).replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (p.startsWith("+")) return p;
  return p;
}

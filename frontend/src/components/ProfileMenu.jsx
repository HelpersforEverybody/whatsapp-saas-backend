// frontend/src/components/ProfileMenu.jsx
import React, { useState } from "react";

/**
 * Small profile menu shown at top-right
 *
 * Props:
 * - name, phone
 * - addresses (array)
 * - onLogout()
 * - onOpenAddressModal() to add/edit addresses
 */
export default function ProfileMenu({ name = "", phone = "", onLogout = () => {}, addresses = [], onOpenAddressModal = () => {} }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <div>
        <button onClick={() => setOpen(v => !v)} className="px-3 py-1 bg-gray-100 border rounded flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-sm">U</span>
          <span className="text-sm">{name || phone}</span>
        </button>
      </div>

      {open && (
        <div className="origin-top-right absolute right-0 mt-2 w-60 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-40">
          <div className="p-3">
            <div className="font-medium">{name || "Unnamed"}</div>
            <div className="text-sm text-gray-600">Phone: {phone || "—"}</div>
          </div>
          <div className="border-t" />
          <div className="p-2">
            <button onClick={() => { onOpenAddressModal(); setOpen(false); }} className="w-full text-left px-2 py-1 rounded hover:bg-gray-50">Manage Addresses</button>
            <button onClick={() => { setOpen(false); onLogout(); }} className="w-full text-left px-2 py-1 rounded hover:bg-gray-50 text-red-600">Logout</button>
          </div>
        </div>
      )}
    </div>
  );
}

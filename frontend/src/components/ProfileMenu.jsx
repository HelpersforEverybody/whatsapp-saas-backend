// frontend/src/components/ProfileMenu.jsx
import React from "react";

/**
 * Simple ProfileMenu placeholder.
 * Props:
 *  - name, phone
 *  - onEdit (optional)
 *  - onLogout (optional)
 */
export default function ProfileMenu({ name = "", phone = "", onEdit = () => {}, onLogout = () => {} }) {
  const displayPhone = phone ? (phone.startsWith("+") ? phone : `+91${phone}`) : "—";
  return (
    <div className="p-3 border rounded bg-white shadow-sm w-64">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl">👤</div>
        <div>
          <div className="font-medium">{name || displayPhone}</div>
          <div className="text-xs text-gray-500">{displayPhone}</div>
        </div>
      </div>

      <div className="space-y-2">
        <button onClick={onEdit} className="w-full px-3 py-1 border rounded text-sm text-left">Edit Profile</button>
        <button onClick={onLogout} className="w-full px-3 py-1 bg-red-500 text-white rounded text-sm">Logout</button>
      </div>
    </div>
  );
}

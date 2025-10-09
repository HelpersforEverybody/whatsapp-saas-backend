// frontend/src/components/ProfileMenu.jsx
import React, { useState, useRef, useEffect } from "react";

/**
 * ProfileMenu Component
 * ---------------------
 * Shows “Logged in as …” with a small dropdown for Profile & Logout.
 *
 * Props:
 * - name: string (customer name)
 * - phone: string (customer phone number)
 * - onLogout: function() -> void
 * - onOpenProfile: function() -> void
 */

export default function ProfileMenu({
  name = "",
  phone = "",
  onLogout = () => {},
  onOpenProfile = () => {},
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName =
    name && name.trim().length > 0
      ? name.trim()
      : phone
      ? `+91${String(phone).replace(/\D/g, "").slice(-10)}`
      : "Guest";

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Profile button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border rounded bg-white hover:bg-gray-50 shadow-sm"
      >
        <span className="text-gray-700 text-sm">
          Logged in as <b>{displayName}</b>
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 transition-transform ${
            open ? "rotate-180" : "rotate-0"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-10">
          <button
            onClick={() => {
              setOpen(false);
              onOpenProfile();
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Profile
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

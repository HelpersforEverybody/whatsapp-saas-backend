// frontend/src/components/ProfileMenu.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function ProfileMenu({ customer, onLogout }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [name, setName] = useState(customer ? customer.name : "");

  useEffect(() => {
    const n = localStorage.getItem("customer_name") || "";
    setName(n || (customer && customer.name) || "");
  }, [customer]);

  function handleLogout() {
    localStorage.removeItem("customer_token");
    localStorage.removeItem("customer_name");
    localStorage.removeItem("customer_phone");
    if (onLogout) onLogout();
    navigate("/shops");
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-100">
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600">👤</div>
        <div className="hidden md:block text-sm">{name || "Customer"}</div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow z-50">
          <div className="p-3 border-b">
            <div className="text-sm font-medium">{name || "Customer"}</div>
            <div className="text-xs text-gray-500">{localStorage.getItem("customer_phone") || ""}</div>
          </div>
          <div className="flex flex-col p-2">
            <Link to="/profile" onClick={() => setOpen(false)} className="px-2 py-1 rounded hover:bg-gray-100">Profile & Orders</Link>
            <Link to="/cart" onClick={() => setOpen(false)} className="px-2 py-1 rounded hover:bg-gray-100">Cart</Link>
            <button onClick={handleLogout} className="text-left px-2 py-1 rounded hover:bg-gray-100">Logout</button>
          </div>
        </div>
      )}
    </div>
  );
}

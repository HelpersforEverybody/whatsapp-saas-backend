// frontend/src/pages/CustomerDashboard.jsx
import React, { useEffect, useState } from "react";

export default function CustomerDashboard() {
  const [customerToken, setCustomerToken] = useState(localStorage.getItem("customer_token") || "");
  const [name, setName] = useState(localStorage.getItem("customer_name") || "");
  const [phone, setPhone] = useState(localStorage.getItem("customer_phone") || "");
  const [addresses, setAddresses] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("customer_addresses") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setCustomerToken(localStorage.getItem("customer_token") || "");
    setName(localStorage.getItem("customer_name") || "");
    setPhone(localStorage.getItem("customer_phone") || "");
  }, []);

  function removeAddress(idx) {
    const cp = [...addresses];
    cp.splice(idx, 1);
    setAddresses(cp);
    localStorage.setItem("customer_addresses", JSON.stringify(cp));
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Your Profile</h2>
          {customerToken ? <button onClick={() => { localStorage.removeItem("customer_token"); window.location.reload(); }} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button> : <div className="text-sm text-gray-600">Not logged in</div>}
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-600">Name</div>
          <div className="font-medium">{name || "—"}</div>
          <div className="text-sm text-gray-600 mt-2">Phone</div>
          <div className="font-medium">{phone ? `+91${phone}` : "—"}</div>
        </div>

        <div>
          <h3 className="font-medium mb-2">Saved Addresses</h3>
          {addresses.length === 0 ? <div className="text-sm text-gray-600">No saved addresses</div> : (
            <div className="space-y-2">
              {addresses.map((a, idx) => (
                <div key={idx} className="p-3 border rounded flex justify-between items-start">
                  <div>
                    <div className="font-medium">{a.name} • +91{a.phone}</div>
                    <div className="text-xs text-gray-600">{a.address}</div>
                    <div className="text-xs text-gray-500 mt-1">Pincode: {a.pincode}</div>
                  </div>
                  <div>
                    <button onClick={() => removeAddress(idx)} className="px-2 py-1 bg-red-500 text-white rounded">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <h3 className="font-medium mb-2">Orders</h3>
          <div className="text-sm text-gray-600">Orders screen is available after placing orders. You can view order history and status there.</div>
        </div>
      </div>
    </div>
  );
}

// frontend/src/pages/CustomerDashboard.jsx
import React, { useEffect, useState } from "react";
import ShopManager from "./ShopManager";
import { getApiBase } from "../hooks/useApi";

/**
 * CustomerDashboard wrapper page.
 * The project's ShopManager already handles the shops/menu/cart flows.
 * We expose a dedicated route that shows ShopManager and top-profile badge.
 */
export default function CustomerDashboard() {
  const [name, setName] = useState(localStorage.getItem("customer_name") || "");
  const [phoneDigits, setPhoneDigits] = useState(localStorage.getItem("customer_phone") || "");
  const [token, setToken] = useState(localStorage.getItem("customer_token") || "");

  useEffect(() => {
    const t = localStorage.getItem("customer_token") || "";
    setToken(t);
    setName(localStorage.getItem("customer_name") || "");
    setPhoneDigits(localStorage.getItem("customer_phone") || "");
  }, []);

  return (
    <div>
      {/* top badge */}
      <div className="max-w-5xl mx-auto my-4 flex justify-end gap-3 items-center">
        {token ? (
          <div className="text-sm">
            Logged in as <b>{name || `+91${phoneDigits}`}</b>
          </div>
        ) : (
          <div className="text-sm text-gray-600">Not logged in</div>
        )}
      </div>

      {/* main ShopManager UI */}
      <ShopManager />
    </div>
  );
}

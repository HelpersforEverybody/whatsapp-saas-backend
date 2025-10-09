// frontend/src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ShopManager from "./pages/ShopManager";
import MerchantSignup from "./pages/MerchantSignup";
import MerchantLogin from "./pages/MerchantLogin";
import OwnerDashboard from "./pages/OwnerDashboard";
import CustomerOtpLogin from "./pages/CustomerOtpLogin";
import Cart from "./pages/Cart";
import CustomerDashboard from "./pages/CustomerDashboard";
import ProfileMenu from "./components/ProfileMenu";

export default function App() {
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("customer_token");
    if (token) {
      const name = localStorage.getItem("customer_name") || "";
      const phone = localStorage.getItem("customer_phone") || "";
      setCustomer({ name, phone });
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("customer_token");
    localStorage.removeItem("customer_name");
    localStorage.removeItem("customer_phone");
    setCustomer(null);
  };

  return (
    <BrowserRouter>
      <nav className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b">
        <div className="flex items-center gap-4 text-sm">
          <Link to="/">🏠 Dashboard</Link>
          <Link to="/shops">🛍 Shops</Link>
          <Link to="/merchant-signup">✍️ Merchant Signup</Link>
          <Link to="/merchant-login">🔐 Merchant Login</Link>
          <Link to="/owner-dashboard">👨‍🍳 Owner Dashboard</Link>
        </div>
        {customer ? (
          <ProfileMenu customer={customer} onLogout={logout} />
        ) : (
          <Link to="/customer-login" className="text-sm text-blue-600">Login</Link>
        )}
      </nav>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/shops" element={<ShopManager />} />
        <Route path="/merchant-signup" element={<MerchantSignup />} />
        <Route path="/merchant-login" element={<MerchantLogin />} />
        <Route path="/owner-dashboard" element={<OwnerDashboard />} />
        <Route path="/customer-login" element={<CustomerOtpLogin />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/profile" element={<CustomerDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

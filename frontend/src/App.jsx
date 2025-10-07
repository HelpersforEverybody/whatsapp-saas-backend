// frontend/src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ShopManager from "./pages/ShopManager";
import MerchantSignup from "./pages/MerchantSignup";
import MerchantLogin from "./pages/MerchantLogin";
import OwnerDashboard from "./pages/OwnerDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: 10, background: "#fafafa", borderBottom: "1px solid #ddd" }}>
        <Link to="/" style={{ marginRight: 10 }}>🏠 Dashboard</Link>
        <Link to="/shops" style={{ marginRight: 10 }}>🛍 Shops & Menu</Link>
        <Link to="/merchant-signup" style={{ marginRight: 10 }}>✍️ Merchant Signup</Link>
        <Link to="/merchant-login" style={{ marginRight: 10 }}>🔐 Merchant Login</Link>
        <Link to="/owner-dashboard">👨‍🍳 Owner Dashboard</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/shops" element={<ShopManager />} />
        <Route path="/merchant-signup" element={<MerchantSignup />} />
        <Route path="/merchant-login" element={<MerchantLogin />} />
        <Route path="/owner-dashboard" element={<OwnerDashboard />} />
        <Route path="/customer-login" element={<CustomerOtpLogin />} />
      </Routes>
    </BrowserRouter>
  );
}

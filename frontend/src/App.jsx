import React from 'react';
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ShopManager from "./pages/ShopManager";

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: 10, background: "#fafafa", borderBottom: "1px solid #ddd" }}>
        <Link to="/" style={{ marginRight: 10 }}>🏠 Dashboard</Link>
        <Link to="/shops">🛍 Shops & Menu</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/shops" element={<ShopManager />} />
      </Routes>
    </BrowserRouter>
  );
}

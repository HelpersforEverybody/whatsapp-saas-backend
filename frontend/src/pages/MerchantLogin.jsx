// src/pages/MerchantLogin.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "https://whatsapp-saas-backend-f9ot.onrender.com";

export default function MerchantLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch (err) { json = { error: "invalid_response", text }; }

      if (!res.ok) {
        console.error("Login failed", res.status, json);
        alert("Login failed: " + (json.error || JSON.stringify(json)));
        setLoading(false);
        return;
      }

      // login success — expect { token, role, merchant/user }
      if (json.token) {
        localStorage.setItem("auth_token", json.token);
        localStorage.setItem("auth_role", json.role || "merchant");
        localStorage.setItem("auth_user", JSON.stringify(json.merchant || json.user || {}));
        alert("Login successful");
        navigate("/owner-dashboard");
        return;
      }

      alert("Login returned unexpected response: " + JSON.stringify(json));
    } catch (err) {
      console.error("Login exception", err);
      alert("Login failed: " + (err && err.message ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Merchant Login</h2>
      <form onSubmit={handleLogin} className="space-y-3">
        <input className="w-full p-2 border rounded" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        <input className="w-full p-2 border rounded" placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded" disabled={loading}>
            {loading ? "Signing..." : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}

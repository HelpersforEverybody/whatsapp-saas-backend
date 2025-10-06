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
    e && e.preventDefault();
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

      if (!json || !json.token) {
        console.error("Login success but missing token", json);
        alert("Login returned no token. Check server response in console.");
        setLoading(false);
        return;
      }

      // Save token & metadata for other pages to use
      localStorage.setItem("auth_token", json.token);
      if (json.role) localStorage.setItem("auth_role", json.role);
      if (json.merchant || json.user) localStorage.setItem("auth_user", JSON.stringify(json.merchant || json.user));

      // also keep admin_api_key compatibility if your app uses that
      if (json.apiKey) localStorage.setItem("admin_api_key", json.apiKey);

      // best-effort navigate to owner dashboard
      try {
        navigate("/owner-dashboard");
        // If navigate does nothing (e.g. blocked), force full page load as fallback
        setTimeout(() => {
          if (window.location.pathname !== "/owner-dashboard") window.location.href = "/owner-dashboard";
        }, 250);
      } catch (err) {
        console.warn("navigate failed, forcing location:", err);
        window.location.href = "/owner-dashboard";
      }
    } catch (err) {
      console.error("Login exception", err);
      alert("Login failed: " + (err && err.message ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  // optional: if user already logged in, redirect immediately
  React.useEffect(() => {
    const t = localStorage.getItem("auth_token");
    if (t) {
      // token exists — go to dashboard
      try { navigate("/owner-dashboard"); } catch { window.location.href = "/owner-dashboard"; }
    }
    // eslint-disable-next-line
  }, []);

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

// frontend/src/pages/MerchantLogin.jsx
import React, { useState } from "react";
import { getApiBase } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";

export default function MerchantLogin() {
  const API_BASE = getApiBase();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  async function doLogin(e) {
    e && e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/merchant-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password })
      });
      if (!res.ok) {
        const txt = await res.text();
        alert("Login failed: " + (txt || res.status));
        setLoading(false);
        return;
      }
      const data = await res.json();
      localStorage.setItem("merchant_token", data.token);
      alert("Login OK");
      navigate("/owner-dashboard");
    } catch (err) {
      console.error(err);
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-3">Merchant Login</h2>
        <form onSubmit={doLogin} className="space-y-3">
          <input value={form.email} onChange={e=>setForm({...form, email:e.target.value})}
            placeholder="Email" required className="w-full p-2 border rounded" />
          <input value={form.password} onChange={e=>setForm({...form, password:e.target.value})}
            type="password" placeholder="Password" required className="w-full p-2 border rounded" />
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="bg-blue-600 text-white px-3 py-2 rounded">
              {loading ? "Signing..." : "Sign in"}
            </button>
            <button type="button" onClick={()=>navigate("/merchant-signup")} className="px-3 py-2 rounded border">
              Create account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

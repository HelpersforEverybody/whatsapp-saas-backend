// src/pages/MerchantSignup.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "https://whatsapp-saas-backend-f9ot.onrender.com";

export default function MerchantSignup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSignup(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: email.split("@")[0] || "merchant" }),
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch (err) { json = { error: "invalid_response", text }; }

      if (!res.ok) {
        console.error("Signup error:", res.status, json);
        alert("Signup failed: " + (json.error || JSON.stringify(json)));
        setLoading(false);
        return;
      }

      // success: backend returned { token, role, merchant }
      if (json.token) {
        // store token + role safe-ish (token is required for owner flows)
        localStorage.setItem("auth_token", json.token);
        localStorage.setItem("auth_role", json.role || "merchant");
        localStorage.setItem("auth_user", JSON.stringify(json.merchant || json.user || {}));

        // if user supplied a shop name, create the shop owned by this merchant (requires auth)
        if (shopName && shopPhone) {
          try {
            await fetch(`${API_BASE}/api/shops`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${json.token}`
              },
              body: JSON.stringify({ name: shopName, phone: shopPhone }),
            });
            // ignore response: user can manage shops in owner dashboard
          } catch (err) {
            console.warn("Create shop failed (nonfatal)", err);
          }
        }

        alert("Signup successful — redirecting to Owner Dashboard");
        navigate("/owner-dashboard");
        return;
      }

      // If we reached here, treat as error
      alert("Signup returned unexpected response: " + JSON.stringify(json));
    } catch (err) {
      console.error("Signup exception", err);
      alert("Signup failed: " + (err && err.message ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Create Merchant account</h2>
      <form onSubmit={handleSignup} className="space-y-3">
        <input className="w-full p-2 border rounded" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="w-full p-2 border rounded" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <hr/>
        <div className="text-sm text-gray-600">Optional: create a shop now (you can add later)</div>
        <input className="w-full p-2 border rounded" placeholder="Shop name" value={shopName} onChange={e => setShopName(e.target.value)} />
        <input className="w-full p-2 border rounded" placeholder="Shop phone +91..." value={shopPhone} onChange={e => setShopPhone(e.target.value)} />
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded" disabled={loading}>
            {loading ? "Signing..." : "Create account"}
          </button>
        </div>
      </form>
    </div>
  );
}

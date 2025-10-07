// frontend/src/pages/MerchantSignup.jsx
import React, { useState } from "react";
import { getApiBase } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";

export default function MerchantSignup() {
  const API_BASE = getApiBase();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    shopName: "",
    shopPhone: "",
    shopDescription: ""
  });
  const navigate = useNavigate();

  async function doSignup(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        createShop: {
          name: form.shopName,
          phone: form.shopPhone,
          description: form.shopDescription
        }
      };
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.status === 201) {
        alert("Signup successful — you can now login.");
        navigate("/merchant-login");
      } else {
        const txt = await res.text();
        alert("Signup failed: " + (txt || res.status));
      }
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
        <h2 className="text-xl font-semibold mb-3">Merchant Signup</h2>
        <form onSubmit={doSignup} className="space-y-3">
          <input required value={form.name} onChange={e=>setForm({...form, name:e.target.value})}
            placeholder="Your name" className="w-full p-2 border rounded" />
          <input required value={form.email} onChange={e=>setForm({...form, email:e.target.value})}
            placeholder="Email" type="email" className="w-full p-2 border rounded" />
          <input required value={form.password} onChange={e=>setForm({...form, password:e.target.value})}
            placeholder="Password" type="password" className="w-full p-2 border rounded" />
          <hr className="my-2" />
          <div className="text-sm text-gray-600">Create shop (optional) — will be owned by you</div>
          <input value={form.shopName} onChange={e=>setForm({...form, shopName:e.target.value})}
            placeholder="Shop name" className="w-full p-2 border rounded" />
          <input value={form.shopPhone} onChange={e=>setForm({...form, shopPhone:e.target.value})}
            placeholder="Shop phone (+91...)" className="w-full p-2 border rounded" />
          <textarea value={form.shopDescription} onChange={e=>setForm({...form, shopDescription:e.target.value})}
            placeholder="Shop description" className="w-full p-2 border rounded" rows={3} />
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="bg-blue-600 text-white px-3 py-2 rounded">
              {loading ? "Signing..." : "Sign up & create shop"}
            </button>
            <button type="button" onClick={()=>navigate("/merchant-login")} className="px-3 py-2 rounded border">
              Already have account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// frontend/src/pages/MerchantSignup.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBase } from "../hooks/useApi";

const API_BASE = getApiBase();

export default function MerchantSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  // optional create shop
  const [createShopNow, setCreateShopNow] = useState(false);
  const [shop, setShop] = useState({
    name: "",
    phone: "",
    description: "",
    pincode: "",
  });

  const [loading, setLoading] = useState(false);

  function onChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function onShopChange(e) {
    const { name, value } = e.target;
    setShop(s => ({ ...s, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      return alert("Name, email and password are required");
    }

    // validate optional phone (if createShopNow)
    if (createShopNow) {
      if (!shop.name || !shop.phone) {
        return alert("Shop name and phone are required to create a shop now");
      }
      // basic phone digits check (allow + and digits)
      const digits = String(shop.phone).replace(/[^\d+]/g, "");
      if (!/^\+?\d{10,15}$/.test(digits)) {
        return alert("Shop phone looks invalid (use 10-15 digits, optional +)");
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
      };
      if (createShopNow) {
        payload.createShop = {
          name: shop.name,
          phone: shop.phone,
          description: shop.description || "",
          pincode: shop.pincode || "",
        };
      }

      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `${res.status}`);
      }

      const data = await res.json();
      // server returns { userId, shopId? }
      alert("Signup successful. Please login.");
      navigate("/merchant-login");
    } catch (err) {
      console.error("Signup failed", err);
      alert("Signup failed: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
        <h2 className="text-2xl font-semibold mb-4">Merchant Signup</h2>
        <form onSubmit={submit}>
          <label className="block mb-2">
            <div className="text-sm text-gray-600">Your name</div>
            <input name="name" value={form.name} onChange={onChange} className="w-full p-2 border rounded" />
          </label>

          <label className="block mb-2">
            <div className="text-sm text-gray-600">Email</div>
            <input name="email" value={form.email} onChange={onChange} type="email" className="w-full p-2 border rounded" />
          </label>

          <label className="block mb-4">
            <div className="text-sm text-gray-600">Password</div>
            <input name="password" value={form.password} onChange={onChange} type="password" className="w-full p-2 border rounded" />
          </label>

          <label className="flex items-center gap-2 mb-3">
            <input type="checkbox" checked={createShopNow} onChange={() => setCreateShopNow(s => !s)} />
            <span>Create a shop now (optional)</span>
          </label>

          {createShopNow && (
            <div className="mb-4 border p-3 rounded bg-gray-50">
              <label className="block mb-2">
                <div className="text-sm text-gray-600">Shop name</div>
                <input name="name" value={shop.name} onChange={onShopChange} className="w-full p-2 border rounded" />
              </label>

              <label className="block mb-2">
                <div className="text-sm text-gray-600">Shop phone (use +91XXXXXXXXXX or local 10 digits)</div>
                <input name="phone" value={shop.phone} onChange={onShopChange} className="w-full p-2 border rounded" />
              </label>

              <label className="block mb-2">
                <div className="text-sm text-gray-600">Pincode (optional)</div>
                <input name="pincode" value={shop.pincode} onChange={onShopChange} className="w-full p-2 border rounded" />
              </label>

              <label className="block">
                <div className="text-sm text-gray-600">Short description (optional)</div>
                <input name="description" value={shop.description} onChange={onShopChange} className="w-full p-2 border rounded" />
              </label>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button disabled={loading} type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
              {loading ? "Signing up..." : "Sign up"}
            </button>
            <button type="button" className="text-sm text-gray-600" onClick={() => navigate("/merchant-login")}>
              Already have an account? Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

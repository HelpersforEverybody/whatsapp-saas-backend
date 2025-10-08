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
const [shop, setShop] = useState({
  name: "",
  phone: "",
  address: "",
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

  async function tryAutoLogin(email, password) {
    try {
      const res = await fetch(`${API_BASE}/auth/merchant-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `status:${res.status}`);
      }
      const data = await res.json();
      // server returns { token, userId } on merchant-login
      if (data.token) {
        localStorage.setItem("merchant_token", data.token);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Auto-login failed", err);
      return false;
    }
  }

  async function submit(e) {
  e.preventDefault();

  if (!form.name || !form.email || !form.password) {
    return alert("Name, email and password are required");
  }

  // always require shop creation
  if (!shop.name || !shop.phone || !shop.address || !shop.pincode) {
    return alert("Shop name, phone, address, and pincode are required");
  }

  setLoading(true);
  try {
    const payload = {
      name: form.name,
      email: form.email,
      password: form.password,
      createShop: {
        name: shop.name,
        phone: shop.phone,
        address: shop.address,
        description: shop.description || "",
        pincode: shop.pincode || "",
      },
    };

    // 1) Signup
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

    // 2) Try auto-login immediately using same email/password
    const loggedIn = await tryAutoLogin(form.email, form.password);
    if (loggedIn) {
      navigate("/owner-dashboard");
    } else {
      alert("Signup successful, but auto-login failed — please login manually.");
      navigate("/merchant-login");
    }
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

          <div className="mb-4 border p-3 rounded bg-gray-50">
  <label className="block mb-2">
    <div className="text-sm text-gray-600">Shop name</div>
    <input name="name" value={shop.name} onChange={onShopChange} className="w-full p-2 border rounded" />
  </label>

  <label className="block mb-2">
    <div className="text-sm text-gray-600">Shop phone</div>
    <input name="phone" value={shop.phone} onChange={onShopChange} className="w-full p-2 border rounded" />
  </label>

  <label className="block mb-2">
    <div className="text-sm text-gray-600">Shop address</div>
    <input name="address" value={shop.address} onChange={onShopChange} className="w-full p-2 border rounded" />
  </label>

  <label className="block mb-2">
    <div className="text-sm text-gray-600">Pincode</div>
    <input name="pincode" value={shop.pincode} onChange={onShopChange} className="w-full p-2 border rounded" />
  </label>

  <label className="block">
    <div className="text-sm text-gray-600">Short description (optional)</div>
    <input name="description" value={shop.description} onChange={onShopChange} className="w-full p-2 border rounded" />
  </label>
</div>


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

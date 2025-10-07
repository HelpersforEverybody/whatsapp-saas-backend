// frontend/src/pages/CustomerOtpLogin.jsx
import React, { useState } from "react";
import { getApiBase } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";

export default function CustomerOtpLogin() {
  const API_BASE = getApiBase();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // ensure phone shows +91 prefix visually but keep digits
  function formatPhoneDisplay(v) {
    if (!v) return "";
    // remove non-digit except leading +
    const raw = v.replace(/[^\d+]/g, "");
    if (raw.startsWith("+")) return raw;
    // if 10 digits, auto prefix +91
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    return raw;
  }

  function validatePhone(v) {
    const z = v.replace(/[^\d]/g, "");
    // accept exactly 10 digits (no country code entered) or +91XXXXXXXXXX or full international
    if (/^\+91\d{10}$/.test(v) || /^\d{10}$/.test(z)) return true;
    return false;
  }

  async function sendOtp(e) {
    e && e.preventDefault();
    setPhoneErr("");
    setStatusMsg("");
    const display = formatPhoneDisplay(phone);
    if (!validatePhone(display)) {
      setPhoneErr("Enter exactly 10 digits (we will prefix +91).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: display }),
      });
      const txt = await res.text();
      if (!res.ok) {
        setStatusMsg(`Failed to send OTP: ${txt || res.status}`);
        setLoading(false);
        return;
      }
      setOtpSent(true);
      setStatusMsg("OTP sent — check server logs for test OTP in dev.");
    } catch (err) {
      console.error(err);
      setStatusMsg("Network error sending OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e) {
    e && e.preventDefault();
    setStatusMsg("");
    const display = formatPhoneDisplay(phone);
    if (!otp || otp.trim().length < 4) {
      setStatusMsg("Enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: display, otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg(`Verify failed: ${data && data.error ? JSON.stringify(data) : res.status}`);
        setLoading(false);
        return;
      }
      // store token and redirect to shops page
      localStorage.setItem("customer_token", data.token);
      setStatusMsg("Login successful");
      navigate("/shops"); // or wherever customers go
    } catch (err) {
      console.error(err);
      setStatusMsg("Network error verifying OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-md bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-3">Customer login — OTP (test)</h2>

        <form onSubmit={otpSent ? verifyOtp : sendOtp} className="space-y-3">
          <div>
            <label className="text-sm block mb-1">Phone</label>
            <div className="flex">
              <input
                value={formatPhoneDisplay(phone)}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10 digits (we add +91)"
                className="w-full p-2 border rounded"
              />
            </div>
            {phoneErr ? <div className="text-sm text-red-600 mt-1">{phoneErr}</div> : null}
          </div>

          {!otpSent ? (
            <div className="flex gap-2">
              <button disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm block mb-1">OTP</label>
                <input value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full p-2 border rounded" />
              </div>

              <div className="flex gap-2">
                <button disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded">
                  {loading ? "Verifying..." : "Verify OTP"}
                </button>
                <button type="button" onClick={sendOtp} className="px-4 py-2 bg-gray-200 rounded">
                  Resend OTP
                </button>
              </div>
            </>
          )}

          {statusMsg ? <div className="text-sm text-gray-700 mt-2">{statusMsg}</div> : null}
          <div className="text-xs text-gray-400 mt-2">Note: SMS sending is simulated — OTP logged in server console (dev only).</div>
        </form>
      </div>
    </div>
  );
}

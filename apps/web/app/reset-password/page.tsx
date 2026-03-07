"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
  };

  const allValid = passwordChecks.length && passwordChecks.uppercase && passwordChecks.lowercase && passwordChecks.number && password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!PASSWORD_REGEX.test(password)) { setError("Password doesn't meet requirements"); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    if (!token) { setError("Invalid reset link"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 8 }}>Invalid Reset Link</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>This reset link is missing or invalid.</p>
        <Link href="/forgot-password" style={{ fontSize: 13, color: "#111", fontWeight: 600, textDecoration: "none" }}>Request a new one →</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 48, height: 48, background: "#f0fdf4", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 8 }}>Password Reset</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Your password has been successfully reset.</p>
        <Link href="/sign-in" style={{
          display: "inline-block", padding: "12px 32px", background: "#111", color: "#fff",
          borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none",
        }}>Sign In</Link>
      </div>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 4 }}>Set new password</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>Choose a strong password for your account.</p>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>New Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
            placeholder="••••••••" />
        </div>

        {password.length > 0 && (
          <div style={{ marginBottom: 16, padding: "10px 12px", background: "#f9fafb", borderRadius: 8, fontSize: 12 }}>
            {[
              { check: passwordChecks.length, label: "At least 8 characters" },
              { check: passwordChecks.uppercase, label: "1 uppercase letter" },
              { check: passwordChecks.lowercase, label: "1 lowercase letter" },
              { check: passwordChecks.number, label: "1 number" },
            ].map(({ check, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, color: check ? "#16a34a" : "#9ca3af" }}>
                <span style={{ fontSize: 14 }}>{check ? "✓" : "○"}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Confirm Password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password"
            style={{
              width: "100%", padding: "10px 12px",
              border: `1px solid ${confirmPassword && confirmPassword !== password ? "#ef4444" : "#d1d5db"}`,
              borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box",
            }}
            placeholder="••••••••" />
          {confirmPassword && confirmPassword !== password && (
            <span style={{ fontSize: 11, color: "#ef4444", marginTop: 4, display: "block" }}>Passwords don't match</span>
          )}
        </div>

        <button type="submit" disabled={loading || !allValid}
          style={{ width: "100%", padding: "12px 0", background: loading || !allValid ? "#9ca3af" : "#111", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading || !allValid ? "not-allowed" : "pointer" }}>
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050a0e" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/"><img src="/logo.png" alt="Complyva" style={{ height: 28 }} /></Link>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
          <Suspense fallback={<div style={{ textAlign: "center", color: "#6b7280" }}>Loading...</div>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

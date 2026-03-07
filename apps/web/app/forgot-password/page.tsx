"use client";

import { useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed");
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050a0e" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/"><img src="/logo.png" alt="Complyva" style={{ height: 28 }} /></Link>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 48, height: 48, background: "#f0fdf4", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 4 }}>Check your email</h1>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
                If an account exists for <strong>{email}</strong>, we've sent a password reset link. The link expires in 15 minutes.
              </p>
              <p style={{ fontSize: 12, color: "#6b7280" }}>
                Didn't receive it? Check your spam folder or{" "}
                <button onClick={() => setSent(false)} style={{ background: "none", border: "none", color: "#111", fontWeight: 600, cursor: "pointer", textDecoration: "underline", fontSize: 12, padding: 0 }}>
                  try again
                </button>
              </p>
              <Link href="/sign-in" style={{ display: "inline-block", marginTop: 20, fontSize: 12, color: "#6b7280", textDecoration: "none" }}>← Back to sign in</Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 4 }}>Forgot password?</h1>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>Enter your email and we'll send you a reset link.</p>

              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    placeholder="you@company.com" />
                </div>
                <button type="submit" disabled={loading}
                  style={{ width: "100%", padding: "12px 0", background: loading ? "#9ca3af" : "#111", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
              <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280", marginTop: 20 }}>
                <Link href="/sign-in" style={{ color: "#111", fontWeight: 600, textDecoration: "none" }}>← Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

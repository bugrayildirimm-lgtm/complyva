"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";

export default function SignUpPage() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
  };
  const passwordValid = passwordChecks.length && passwordChecks.uppercase && passwordChecks.lowercase && passwordChecks.number;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!passwordValid) { setError("Password doesn't meet all requirements"); return; }
    setLoading(true);
    try {
      const result = await register(email, password, fullName);
      if (result.verified) {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      setError(err.message || "Registration failed");
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 4 }}>Set up your account</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>Complete your registration to join your organisation</p>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 16 }}>{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                placeholder="John Smith" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                placeholder="you@company.com" />
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Use the email address your admin invited you with.</div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" minLength={8}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                placeholder="Min. 8 characters" />
              {password.length > 0 && (
                <div style={{ marginTop: 8, padding: "8px 10px", background: "#f9fafb", borderRadius: 6, fontSize: 11 }}>
                  {[
                    { check: passwordChecks.length, label: "At least 8 characters" },
                    { check: passwordChecks.uppercase, label: "1 uppercase letter" },
                    { check: passwordChecks.lowercase, label: "1 lowercase letter" },
                    { check: passwordChecks.number, label: "1 number" },
                  ].map(({ check, label }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, color: check ? "#16a34a" : "#9ca3af" }}>
                      <span style={{ fontSize: 12 }}>{check ? "✓" : "○"}</span><span>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" disabled={loading || !passwordValid}
              style={{ width: "100%", padding: "12px 0", background: loading || !passwordValid ? "#9ca3af" : "#111", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading || !passwordValid ? "not-allowed" : "pointer" }}>
              {loading ? "Setting up..." : "Set Up Account"}
            </button>
          </form>
          <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280", marginTop: 20 }}>
            Already have an account?{" "}
            <Link href="/sign-in" style={{ color: "#111", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

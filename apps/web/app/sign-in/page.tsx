"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";

function SignInInner() {
  const { login, verifyCode, resendCode } = useAuth();
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const searchParams = useSearchParams();
  const inactivityLogout = searchParams.get("reason") === "inactivity";

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.verified) {
        window.location.href = "/dashboard";
      } else {
        setUserId(result.userId!);
        setStep("code");
        setResendCooldown(60);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all 6 digits entered
    if (newCode.every((d) => d !== "") && value) {
      handleVerify(newCode.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split("");
      setCode(newCode);
      handleVerify(pasted);
    }
  };

  const handleVerify = async (codeStr?: string) => {
    const finalCode = codeStr || code.join("");
    if (finalCode.length !== 6) return;
    setError("");
    setLoading(true);
    try {
      await verifyCode(userId, finalCode, rememberDevice);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Verification failed");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendCode(userId);
      setResendCooldown(60);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to resend");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#050a0e",
    }}>
      <div style={{ width: "100%", maxWidth: 400, padding: 24 }}>
        {inactivityLogout && <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#92400e", marginBottom: 16, textAlign: "center" }}>You were signed out due to inactivity. Please sign in again.</div>}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/">
            <img src="/logo.png" alt="Complyva" style={{ height: 28 }} />
          </Link>
        </div>

        <div style={{
          background: "#fff",
          borderRadius: 12,
          padding: 32,
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        }}>
          {step === "credentials" ? (
            <>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 4 }}>Welcome back</h1>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>Sign in to your account</p>

              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleCredentials}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    placeholder="you@company.com" />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    placeholder="••••••••" />
                  <div style={{ textAlign: "right", marginTop: 6 }}>
                    <Link href="/forgot-password" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>Forgot password?</Link>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  style={{ width: "100%", padding: "12px 0", background: loading ? "#9ca3af" : "#111", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>


            </>
          ) : (
            <>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 48, height: 48, background: "#f0fdf4", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 4 }}>Check your email</h1>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
                  We sent a 6-digit code to <strong>{email}</strong>
                </p>
              </div>

              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 16, textAlign: "center" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }} onPaste={handlePaste}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    style={{
                      width: 46, height: 54, textAlign: "center", fontSize: 22, fontWeight: 700,
                      border: digit ? "2px solid #111" : "1px solid #d1d5db",
                      borderRadius: 10, outline: "none", boxSizing: "border-box",
                    }}
                  />
                ))}
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 20, justifyContent: "center" }}>
                <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#111" }} />
                <span style={{ fontSize: 13, color: "#374151" }}>Remember this device for 30 days</span>
              </label>

              <button onClick={() => handleVerify()} disabled={loading || code.join("").length !== 6}
                style={{
                  width: "100%", padding: "12px 0",
                  background: loading || code.join("").length !== 6 ? "#9ca3af" : "#111",
                  color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: loading || code.join("").length !== 6 ? "not-allowed" : "pointer",
                }}>
                {loading ? "Verifying..." : "Verify & Sign In"}
              </button>

              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button onClick={handleResend} disabled={resendCooldown > 0}
                  style={{ background: "none", border: "none", fontSize: 12, color: resendCooldown > 0 ? "#9ca3af" : "#111", fontWeight: 600, cursor: resendCooldown > 0 ? "default" : "pointer", textDecoration: resendCooldown > 0 ? "none" : "underline" }}>
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>

              <div style={{ textAlign: "center", marginTop: 12 }}>
                <button onClick={() => { setStep("credentials"); setError(""); setCode(["", "", "", "", "", ""]); }}
                  style={{ background: "none", border: "none", fontSize: 12, color: "#6b7280", cursor: "pointer" }}>
                  ← Back to sign in
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return <Suspense><SignInInner /></Suspense>;
}

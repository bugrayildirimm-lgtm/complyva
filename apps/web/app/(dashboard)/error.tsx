"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  const isAuthError =
    error.message?.includes("Not signed in") ||
    error.message?.includes("Sync failed") ||
    error.message?.includes("No email");

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "60vh", padding: 40, textAlign: "center",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>
        {isAuthError ? "🔒" : "⚠️"}
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 8 }}>
        {isAuthError ? "Authentication Error" : "Something went wrong"}
      </h2>
      <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 400, marginBottom: 24 }}>
        {isAuthError
          ? "We couldn't verify your account. Please sign out and sign back in."
          : "An unexpected error occurred. Please try again."}
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={reset}
          style={{
            padding: "10px 20px", fontSize: 13, fontWeight: 600, borderRadius: 8,
            background: "#111", color: "#fff", border: "none", cursor: "pointer",
          }}
        >
          Try Again
        </button>
        <a
          href="/sign-in"
          style={{
            padding: "10px 20px", fontSize: 13, fontWeight: 600, borderRadius: 8,
            background: "#fff", color: "#111", border: "1px solid #d1d5db", cursor: "pointer",
            textDecoration: "none",
          }}
        >
          Sign In Again
        </a>
      </div>
      {error.digest && (
        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 16 }}>
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}

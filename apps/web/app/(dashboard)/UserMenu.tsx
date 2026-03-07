"use client";

import { useAuth } from "../../lib/auth-context";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UserMenu() {
  const { user, logout, loading, orgs, currentOrgId, switchOrg, fetchOrgs } = useAuth();
  const [open, setOpen] = useState(false);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowOrgSwitcher(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && orgs.length === 0) fetchOrgs();
  }, [open, orgs.length, fetchOrgs]);

  if (loading) return <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e5e7eb" }} />;
  if (!user) return null;

  const initials = (user.full_name || user.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => { setOpen(!open); setShowOrgSwitcher(false); }}
        style={{
          width: 36, height: 36, borderRadius: "50%", background: "#1f2937", color: "#fff",
          border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: "0.02em",
        }}
        title={user.full_name || user.email}
      >
        {initials}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: 44, right: 0, background: "#fff",
          border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          minWidth: 240, zIndex: 100, overflow: "hidden",
        }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{user.full_name || "—"}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{user.email}</div>
          </div>

          {/* Org Switcher */}
          {orgs.length > 1 && !showOrgSwitcher && (
            <button
              onClick={() => setShowOrgSwitcher(true)}
              style={{
                display: "flex", width: "100%", padding: "10px 16px", background: "none", border: "none",
                borderBottom: "1px solid #f3f4f6", cursor: "pointer", fontSize: 12, color: "#374151",
                textAlign: "left", alignItems: "center", justifyContent: "space-between",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <span>
                <span style={{ color: "#9ca3af", fontSize: 10, display: "block" }}>Organisation</span>
                {user.org_name}
              </span>
              <span style={{ color: "#9ca3af" }}>›</span>
            </button>
          )}

          {orgs.length <= 1 && (
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ color: "#9ca3af", fontSize: 10, display: "block" }}>Organisation</span>
              <span style={{ fontSize: 12, color: "#374151" }}>{user.org_name}</span>
            </div>
          )}

          {showOrgSwitcher && (
            <div style={{ borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ padding: "8px 16px 4px", fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Switch Organisation
              </div>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={async () => {
                    if (org.id !== currentOrgId) {
                      await switchOrg(org.id);
                    }
                    setShowOrgSwitcher(false);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex", width: "100%", padding: "8px 16px", background: org.id === currentOrgId ? "#f0f9ff" : "none",
                    border: "none", cursor: "pointer", fontSize: 12, color: "#374151", textAlign: "left",
                    alignItems: "center", gap: 8,
                  }}
                  onMouseEnter={(e) => { if (org.id !== currentOrgId) e.currentTarget.style.background = "#f9fafb"; }}
                  onMouseLeave={(e) => { if (org.id !== currentOrgId) e.currentTarget.style.background = "none"; }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: 6, background: org.id === currentOrgId ? "#2563eb" : "#e5e7eb",
                    color: org.id === currentOrgId ? "#fff" : "#6b7280", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                  }}>
                    {org.name[0]?.toUpperCase()}
                  </span>
                  <span>
                    <span style={{ display: "block", fontWeight: org.id === currentOrgId ? 600 : 400 }}>{org.name}</span>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>{org.role} · {org.member_count} member{org.member_count !== 1 ? "s" : ""}</span>
                  </span>
                  {org.id === currentOrgId && (
                    <span style={{ marginLeft: "auto", color: "#2563eb", fontSize: 14 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => { setOpen(false); router.push("/account"); }}
            style={{
              display: "block", width: "100%", padding: "10px 16px", background: "none", border: "none",
              borderBottom: "1px solid #f3f4f6", cursor: "pointer", fontSize: 12, color: "#374151", textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            Account Settings
          </button>
          <button
            onClick={() => { setOpen(false); logout(); }}
            style={{
              display: "block", width: "100%", padding: "10px 16px", background: "none", border: "none",
              cursor: "pointer", fontSize: 12, color: "#dc2626", textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

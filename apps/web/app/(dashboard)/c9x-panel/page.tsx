"use client";

import { useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

type Org = {
  id: string; name: string; plan: string; plan_seats: number; extra_seats: number;
  billing_cycle: string; plan_expires_at: string | null; trial_started_at: string | null;
  member_count: number; created_at: string;
};

type Member = {
  id: string; email: string; full_name: string | null; role: string;
  has_password: boolean; created_at: string;
};

export default function OpsConsolePage() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newOrg, setNewOrg] = useState({ orgName: "", adminEmail: "", adminName: "", plan: "trial", trialDays: 7 });

  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [editPlan, setEditPlan] = useState({ plan: "", planSeats: 5, extraSeats: 0, billingCycle: "monthly", expiresAt: "" });

  // Members panel
  const [viewOrg, setViewOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: "user" | "org"; id: string; name: string; isAdmin: boolean } | null>(null);
  const [confirmKey, setConfirmKey] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    "x-admin-key": adminKey,
  }), [adminKey]);

  const fetchOrgs = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/orgs`, { headers: { "x-admin-key": adminKey } });
      if (!res.ok) throw new Error("Unauthorized");
      setOrgs(await res.json());
      setAuthenticated(true);
    } catch { setError("Invalid admin key"); setAuthenticated(false); }
    finally { setLoading(false); }
  }, [adminKey]);

  const fetchMembers = async (org: Org) => {
    setViewOrg(org); setMembersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/orgs/${org.id}/members`, { headers: { "x-admin-key": adminKey } });
      if (!res.ok) throw new Error("Failed");
      setMembers(await res.json());
    } catch { setError("Failed to load members"); }
    finally { setMembersLoading(false); }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/admin/create-org`, { method: "POST", headers: headers(), body: JSON.stringify(newOrg) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess(`Organisation "${newOrg.orgName}" created. Welcome email sent to ${newOrg.adminEmail}.`);
      setNewOrg({ orgName: "", adminEmail: "", adminName: "", plan: "trial", trialDays: 7 });
      setShowCreate(false); fetchOrgs();
    } catch (err: any) { setError(err.message); }
  };

  const handleUpdatePlan = async () => {
    if (!editOrg) return; setError(""); setSuccess("");
    try {
      const body: any = { plan: editPlan.plan, planSeats: editPlan.planSeats, extraSeats: editPlan.extraSeats, billingCycle: editPlan.billingCycle };
      if (editPlan.expiresAt) body.expiresAt = new Date(editPlan.expiresAt).toISOString();
      if (editPlan.plan === "enterprise") body.expiresAt = null;
      const res = await fetch(`${API_BASE}/admin/orgs/${editOrg.id}/plan`, { method: "PUT", headers: headers(), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess(`Plan updated for "${editOrg.name}"`); setEditOrg(null); fetchOrgs();
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.isAdmin && confirmKey !== adminKey) { setError("Admin key does not match."); return; }
    setDeleteLoading(true); setError(""); setSuccess("");
    try {
      const url = deleteTarget.type === "org"
        ? `${API_BASE}/admin/orgs/${deleteTarget.id}`
        : `${API_BASE}/admin/users/${deleteTarget.id}`;
      const res = await fetch(url, { method: "DELETE", headers: { "x-admin-key": adminKey } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess(deleteTarget.type === "org"
        ? `Organisation "${deleteTarget.name}" and all its data permanently deleted.`
        : `User "${deleteTarget.name}" permanently deleted.`);
      setDeleteTarget(null); setConfirmKey("");
      if (deleteTarget.type === "org") { setViewOrg(null); setMembers([]); }
      else if (viewOrg) { fetchMembers(viewOrg); }
      fetchOrgs();
    } catch (err: any) { setError(err.message); }
    finally { setDeleteLoading(false); }
  };

  const PLAN_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    trial: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
    pro: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    enterprise: { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe" },
    suspended: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  };

  // ---------- LOGIN ----------
  if (!authenticated) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 32 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 4 }}>Operations Console</h1>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Enter your admin key to continue.</p>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#dc2626", marginBottom: 16 }}>{error}</div>}
          <form onSubmit={(e) => { e.preventDefault(); fetchOrgs(); }}>
            <input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} autoFocus placeholder="Admin key"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
            <button type="submit" disabled={loading || !adminKey}
              style={{ width: "100%", padding: "10px 0", background: "#111", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {loading ? "Verifying..." : "Access Console"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---------- MAIN ----------
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: 0 }}>Operations Console</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{orgs.length} organisation{orgs.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          style={{ padding: "8px 18px", background: "#111", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {showCreate ? "Cancel" : "+ New Organisation"}
        </button>
      </div>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 16 }}>{error}<button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontWeight: 700 }}>×</button></div>}
      {success && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#16a34a", marginBottom: 16 }}>{success}<button onClick={() => setSuccess("")} style={{ float: "right", background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontWeight: 700 }}>×</button></div>}

      {/* Create org form */}
      {showCreate && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 16 }}>Create New Organisation</div>
          <form onSubmit={handleCreateOrg}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Organisation Name</label>
                <input type="text" value={newOrg.orgName} onChange={(e) => setNewOrg({ ...newOrg, orgName: e.target.value })} required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }} placeholder="Acme Gaming Ltd" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Admin Name</label>
                <input type="text" value={newOrg.adminName} onChange={(e) => setNewOrg({ ...newOrg, adminName: e.target.value })} required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }} placeholder="John Smith" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Admin Email</label>
                <input type="email" value={newOrg.adminEmail} onChange={(e) => setNewOrg({ ...newOrg, adminEmail: e.target.value })} required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }} placeholder="john@acme.com" />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Plan</label>
                  <select value={newOrg.plan} onChange={(e) => setNewOrg({ ...newOrg, plan: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, background: "#fff" }}>
                    <option value="trial">Trial</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
                  </select>
                </div>
                {newOrg.plan === "trial" && (
                  <div style={{ width: 100 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Trial Days</label>
                    <input type="number" value={newOrg.trialDays} onChange={(e) => setNewOrg({ ...newOrg, trialDays: Number(e.target.value) })} min={1} max={90}
                      style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  </div>
                )}
              </div>
            </div>
            <button type="submit" style={{ marginTop: 16, padding: "8px 24px", background: "#111", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Create & Send Welcome Email
            </button>
          </form>
        </div>
      )}

      {/* Orgs table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb", background: "#f9fafb" }}>
              {["Organisation", "Plan", "Members", "Expires", "Created", "Actions"].map((h, i) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: i === 2 ? "center" : i === 5 ? "right" : "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => {
              const ps = PLAN_COLORS[org.plan] || PLAN_COLORS.trial;
              const isExpired = org.plan === "trial" && org.plan_expires_at && new Date(org.plan_expires_at) < new Date();
              return (
                <tr key={org.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{org.name}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>{org.id.slice(0, 8)}...</div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, color: ps.color, background: ps.bg, border: `1px solid ${ps.border}` }}>
                      {org.plan.toUpperCase()}
                    </span>
                    {isExpired && <span style={{ fontSize: 10, color: "#dc2626", marginLeft: 6, fontWeight: 700 }}>EXPIRED</span>}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center", fontSize: 13, color: "#374151" }}>{org.member_count} / {org.plan_seats + (org.extra_seats || 0)}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "#6b7280" }}>{org.plan_expires_at ? new Date(org.plan_expires_at).toLocaleDateString() : "—"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "#6b7280" }}>{new Date(org.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => fetchMembers(org)}
                      style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer" }}>
                      Members
                    </button>
                    <button onClick={() => { setEditOrg(org); setEditPlan({ plan: org.plan, planSeats: org.plan_seats, extraSeats: org.extra_seats || 0, billingCycle: org.billing_cycle || "monthly", expiresAt: org.plan_expires_at ? new Date(org.plan_expires_at).toISOString().split("T")[0] : "" }); }}
                      style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer" }}>
                      Edit Plan
                    </button>
                    <button onClick={() => setDeleteTarget({ type: "org", id: org.id, name: org.name, isAdmin: true })}
                      style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", cursor: "pointer" }}>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {orgs.length === 0 && <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: 13 }}>No organisations yet.</div>}
      </div>

      {/* Members Panel */}
      {viewOrg && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setViewOrg(null); setMembers([]); } }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 560, maxHeight: "80vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: 0 }}>{viewOrg.name} — Members</h2>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{members.length} member{members.length !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => { setViewOrg(null); setMembers([]); }} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer" }}>×</button>
            </div>
            {membersLoading ? (
              <div style={{ textAlign: "center", padding: 20, color: "#9ca3af" }}>Loading...</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>User</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Role</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 10px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{m.full_name || "—"}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{m.email}</div>
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: m.role === "ADMIN" ? "#8b5cf6" : m.role === "AUDITOR" ? "#3b82f6" : "#6b7280" }}>{m.role}</span>
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                          background: m.has_password ? "#f0fdf4" : "#fffbeb",
                          color: m.has_password ? "#16a34a" : "#92400e",
                          border: `1px solid ${m.has_password ? "#bbf7d0" : "#fde68a"}`,
                        }}>
                          {m.has_password ? "ACTIVE" : "PENDING"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 10px", textAlign: "right" }}>
                        <button onClick={() => setDeleteTarget({ type: "user", id: m.id, name: m.full_name || m.email, isAdmin: m.role === "ADMIN" })}
                          style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", cursor: "pointer" }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editOrg && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditOrg(null); }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111", marginBottom: 4, marginTop: 0 }}>Edit Plan — {editOrg.name}</h2>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20, marginTop: 0 }}>{editOrg.member_count} current members</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Plan</label>
                <select value={editPlan.plan} onChange={(e) => setEditPlan({ ...editPlan, plan: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, background: "#fff" }}>
                  <option value="trial">Trial</option><option value="pro">Pro (€99/mo)</option><option value="enterprise">Enterprise</option><option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Billing Cycle</label>
                <select value={editPlan.billingCycle} onChange={(e) => setEditPlan({ ...editPlan, billingCycle: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, background: "#fff" }}>
                  <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Base Seats</label>
                <input type="number" value={editPlan.planSeats} onChange={(e) => setEditPlan({ ...editPlan, planSeats: Number(e.target.value) })} min={1}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Extra Seats (€19/ea)</label>
                <input type="number" value={editPlan.extraSeats} onChange={(e) => setEditPlan({ ...editPlan, extraSeats: Number(e.target.value) })} min={0}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              {editPlan.plan !== "enterprise" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Expires On</label>
                  <input type="date" value={editPlan.expiresAt} onChange={(e) => setEditPlan({ ...editPlan, expiresAt: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
              )}
            </div>
            {editPlan.plan === "pro" && (
              <div style={{ background: "#f9fafb", borderRadius: 6, padding: 12, marginTop: 12, fontSize: 12, color: "#374151" }}>
                Monthly: <strong>€{99 + editPlan.extraSeats * 19}</strong>/mo ({editPlan.planSeats} base + {editPlan.extraSeats} extra seats)
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setEditOrg(null)} style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleUpdatePlan} style={{ padding: "8px 20px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "none", background: "#111", color: "#fff", cursor: "pointer" }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setDeleteTarget(null); setConfirmKey(""); } }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
            <div style={{ width: 48, height: 48, background: "#fef2f2", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#dc2626", textAlign: "center", marginBottom: 8, marginTop: 0 }}>
              {deleteTarget.type === "org" ? "Delete Organisation" : "Delete User"}
            </h2>
            <p style={{ fontSize: 13, color: "#374151", textAlign: "center", marginBottom: 4 }}>
              {deleteTarget.type === "org"
                ? <>This will <strong>permanently delete</strong> &quot;{deleteTarget.name}&quot; and <strong>all its data</strong> (risks, audits, certifications, everything). Users with no other org will also be deleted.</>
                : <>This will <strong>permanently delete</strong> &quot;{deleteTarget.name}&quot; and remove them from all organisations.</>
              }
            </p>
            <p style={{ fontSize: 12, color: "#dc2626", textAlign: "center", fontWeight: 600, marginBottom: 20 }}>This action cannot be undone.</p>

            {deleteTarget.isAdmin && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
                  {deleteTarget.type === "org" ? "Enter admin key to confirm" : "This is an admin user — enter admin key to confirm"}
                </label>
                <input type="password" value={confirmKey} onChange={(e) => setConfirmKey(e.target.value)} placeholder="Admin key"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #fecaca", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", background: "#fef2f2" }} />
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setDeleteTarget(null); setConfirmKey(""); }}
                style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleteLoading || (deleteTarget.isAdmin && confirmKey !== adminKey)}
                style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", background: deleteLoading || (deleteTarget.isAdmin && confirmKey !== adminKey) ? "#fca5a5" : "#dc2626", color: "#fff", cursor: deleteLoading || (deleteTarget.isAdmin && confirmKey !== adminKey) ? "not-allowed" : "pointer" }}>
                {deleteLoading ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useToast } from "../Toast";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "#8b5cf6",
  AUDITOR: "#3b82f6",
  VIEWER: "#6b7280",
};

const ROLE_BG: Record<string, string> = {
  ADMIN: "#f5f3ff",
  AUDITOR: "#eff6ff",
  VIEWER: "#f9fafb",
};

export default function AccountClient({
  account,
  members,
  currentRole,
  updateAccount,
  updateMemberRole,
  removeMember,
  inviteMember,
}: {
  account: { org: any; user: any; memberCount: number };
  members: any[];
  currentRole: string;
  updateAccount: (data: { name: string }) => Promise<void>;
  updateMemberRole: (memberId: string, role: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  inviteMember: (data: { email: string; role: string }) => Promise<void>;
}) {
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const isAdmin = currentRole === "ADMIN";

  // Org name editing
  const [orgName, setOrgName] = useState(account.org?.name || "");
  const [editingOrg, setEditingOrg] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [showInvite, setShowInvite] = useState(false);

  const handleSaveOrg = () => {
    if (!orgName.trim()) return;
    startTransition(async () => {
      try {
        await updateAccount({ name: orgName.trim() });
        toast.success("Organisation name updated");
        setEditingOrg(false);
        router.refresh();
      } catch (e: any) {
        toast.error(e.message || "Failed to update");
      }
    });
  };

  const handleRoleChange = (memberId: string, newRole: string) => {
    startTransition(async () => {
      try {
        await updateMemberRole(memberId, newRole);
        toast.success("Role updated");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message || "Failed to update role");
      }
    });
  };

  const handleRemove = (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from the organisation?`)) return;
    startTransition(async () => {
      try {
        await removeMember(memberId);
        toast.success("Member removed");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message || "Failed to remove");
      }
    });
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    startTransition(async () => {
      try {
        await inviteMember({ email: inviteEmail.trim(), role: inviteRole });
        toast.success(`Invited ${inviteEmail.trim()} as ${inviteRole}`);
        setInviteEmail("");
        setInviteRole("VIEWER");
        setShowInvite(false);
        router.refresh();
      } catch (e: any) {
        toast.error(e.message || "Failed to invite");
      }
    });
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Account</h1>
          <p className="page-subtitle">Manage your profile, organisation, and team</p>
        </div>
      </div>

      {/* Profile Section */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 16 }}>Profile</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {clerkUser?.imageUrl && (
            <img
              src={clerkUser.imageUrl}
              alt="Avatar"
              style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2px solid #e5e7eb" }}
            />
          )}
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#111" }}>
              {clerkUser?.fullName || account.user?.full_name || "—"}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
              {clerkUser?.primaryEmailAddress?.emailAddress || account.user?.email || "—"}
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
                color: ROLE_COLORS[currentRole] || "#6b7280",
                background: ROLE_BG[currentRole] || "#f9fafb",
                border: `1px solid ${ROLE_COLORS[currentRole] || "#e5e7eb"}30`,
              }}>
                {currentRole}
              </span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, fontSize: 12, color: "#9ca3af" }}>
          Profile details are managed through Clerk. Use the avatar menu in the top-right to update your name, email, or password.
        </div>
      </div>

      {/* Organisation Section */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Organisation</div>
          {isAdmin && !editingOrg && (
            <button
              className="btn btn-secondary"
              style={{ padding: "4px 12px", fontSize: 11 }}
              onClick={() => setEditingOrg(true)}
            >
              Edit
            </button>
          )}
        </div>

        {editingOrg ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db",
                fontSize: 13, outline: "none",
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSaveOrg()}
              autoFocus
            />
            <button className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 12 }} onClick={handleSaveOrg} disabled={isPending}>
              Save
            </button>
            <button className="btn btn-secondary" style={{ padding: "8px 12px", fontSize: 12 }} onClick={() => { setEditingOrg(false); setOrgName(account.org?.name || ""); }}>
              Cancel
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 40 }}>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Name</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{account.org?.name || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Members</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{account.memberCount}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Created</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>
                  {account.org?.created_at ? new Date(account.org.created_at).toLocaleDateString() : "—"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Team Members Section */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
            Team Members ({members.length})
          </div>
          {isAdmin && (
            <button
              className="btn btn-primary"
              style={{ padding: "6px 14px", fontSize: 12 }}
              onClick={() => setShowInvite(!showInvite)}
            >
              {showInvite ? "Cancel" : "+ Invite Member"}
            </button>
          )}
        </div>

        {/* Invite Form */}
        {showInvite && isAdmin && (
          <div style={{
            background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8,
            padding: 16, marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Invite a new team member</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db",
                  fontSize: 13, outline: "none",
                }}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                style={{
                  padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db",
                  fontSize: 13, background: "#fff", cursor: "pointer",
                }}
              >
                <option value="VIEWER">Viewer</option>
                <option value="AUDITOR">Auditor</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 12 }} onClick={handleInvite} disabled={isPending || !inviteEmail.trim()}>
                Invite
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
              The user will be added to your organisation. If they don&apos;t have an account yet, they&apos;ll be linked when they sign up with this email.
            </div>
          </div>
        )}

        {/* Members Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Member</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Role</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Joined</th>
                {isAdmin && <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => {
                const isMe = m.id === account.user?.id;
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 12px" }}>
                      <div style={{ fontSize: 13, fontWeight: 550, color: "#111" }}>
                        {m.full_name || "—"}
                        {isMe && <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 6 }}>(you)</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{m.email}</div>
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      {isAdmin && !isMe ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value)}
                          disabled={isPending}
                          style={{
                            padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db",
                            fontSize: 12, background: "#fff", cursor: "pointer",
                            color: ROLE_COLORS[m.role] || "#6b7280",
                            fontWeight: 600,
                          }}
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="AUDITOR">Auditor</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                      ) : (
                        <span style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          color: ROLE_COLORS[m.role] || "#6b7280",
                          background: ROLE_BG[m.role] || "#f9fafb",
                          border: `1px solid ${ROLE_COLORS[m.role] || "#e5e7eb"}30`,
                        }}>
                          {m.role}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 12px", fontSize: 12, color: "#6b7280" }}>
                      {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: "12px 12px", textAlign: "right" }}>
                        {!isMe && (
                          <button
                            onClick={() => handleRemove(m.id, m.full_name || m.email)}
                            disabled={isPending}
                            style={{
                              padding: "4px 10px", borderRadius: 6, border: "1px solid #fecaca",
                              background: "#fef2f2", color: "#ef4444", fontSize: 11, fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {members.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#9ca3af", fontSize: 13 }}>
            No team members found.
          </div>
        )}
      </div>

      {/* Role Permissions Reference */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 16 }}>Role Permissions</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280" }}>Permission</th>
              <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, color: ROLE_COLORS.ADMIN }}>Admin</th>
              <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, color: ROLE_COLORS.AUDITOR }}>Auditor</th>
              <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, color: ROLE_COLORS.VIEWER }}>Viewer</th>
            </tr>
          </thead>
          <tbody>
            {[
              { perm: "View all registers", admin: true, auditor: true, viewer: true },
              { perm: "Export data (Excel/PDF)", admin: true, auditor: true, viewer: true },
              { perm: "Create & edit records", admin: true, auditor: true, viewer: false },
              { perm: "Delete records", admin: true, auditor: true, viewer: false },
              { perm: "Upload evidence", admin: true, auditor: true, viewer: false },
              { perm: "Send to Risk/NC/CAPA", admin: true, auditor: true, viewer: false },
              { perm: "Manage team members", admin: true, auditor: false, viewer: false },
              { perm: "Edit organisation settings", admin: true, auditor: false, viewer: false },
            ].map((row) => (
              <tr key={row.perm} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px 12px", color: "#374151" }}>{row.perm}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>{row.admin ? "✅" : "—"}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>{row.auditor ? "✅" : "—"}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>{row.viewer ? "✅" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

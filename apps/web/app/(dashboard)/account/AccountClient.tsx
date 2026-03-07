"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";
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
  changePassword,
  uploadOrgLogo,
  sessions,
  revokeSession,
  revokeAllSessions,
}: {
  account: { org: any; user: any; memberCount: number };
  members: any[];
  currentRole: string;
  updateAccount: (data: { name?: string; primaryColor?: string; exportAllowedRoles?: string[] }) => Promise<void>;
  updateMemberRole: (memberId: string, role: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  inviteMember: (data: { email: string; role: string; fullName?: string }) => Promise<void>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  uploadOrgLogo: (formData: FormData) => Promise<any>;
  sessions: any[];
  revokeSession: (id: string) => Promise<any>;
  revokeAllSessions: () => Promise<any>;
}) {
  const { user: authUser } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const isAdmin = currentRole === "ADMIN";

  // Org name editing
  const [orgName, setOrgName] = useState(account.org?.name || "");
  const [editingOrg, setEditingOrg] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [showInvite, setShowInvite] = useState(false);

  // Password change
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  const pwChecks = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /\d/.test(newPassword),
  };
  const pwValid = pwChecks.length && pwChecks.uppercase && pwChecks.lowercase && pwChecks.number && newPassword === confirmPassword && confirmPassword.length > 0;

  // Logo upload
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Export controls
  const [exportRoles, setExportRoles] = useState<string[]>(account.org?.export_allowed_roles || ["ADMIN", "AUDITOR", "VIEWER"]);

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
        await inviteMember({ email: inviteEmail.trim(), role: inviteRole, fullName: inviteName.trim() || undefined });
        toast.success(`Invited ${inviteEmail.trim()} as ${inviteRole}`);
        setInviteEmail("");
        setInviteName("");
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
          <div style={{
            width: 56, height: 56, borderRadius: "50%", background: "#1f2937",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 20, fontWeight: 700,
          }}>
            {(authUser?.full_name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#111" }}>
              {authUser?.full_name || account.user?.full_name || "—"}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
              {authUser?.email || account.user?.email || "—"}
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
        <div style={{ marginTop: 16, borderTop: "1px solid #f3f4f6", paddingTop: 16 }}>
          {!showPassword ? (
            <button
              onClick={() => setShowPassword(true)}
              style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer" }}
            >
              Change Password
            </button>
          ) : (
            <div style={{ maxWidth: 360 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12 }}>Change Password</div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Current Password</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                {newPassword.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11 }}>
                    {[
                      { check: pwChecks.length, label: "8+ characters" },
                      { check: pwChecks.uppercase, label: "1 uppercase" },
                      { check: pwChecks.lowercase, label: "1 lowercase" },
                      { check: pwChecks.number, label: "1 number" },
                    ].map(({ check, label }) => (
                      <span key={label} style={{ marginRight: 10, color: check ? "#16a34a" : "#9ca3af" }}>
                        {check ? "✓" : "○"} {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password"
                  style={{ width: "100%", padding: "8px 12px", border: `1px solid ${confirmPassword && confirmPassword !== newPassword ? "#ef4444" : "#d1d5db"}`, borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                {confirmPassword && confirmPassword !== newPassword && (
                  <span style={{ fontSize: 11, color: "#ef4444" }}>Passwords don&apos;t match</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ padding: "8px 16px", fontSize: 12 }}
                  disabled={isPending || !pwValid || !currentPassword}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await changePassword({ currentPassword, newPassword });
                        toast.success("Password changed successfully");
                        setShowPassword(false);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                      } catch (e: any) {
                        toast.error(e.message || "Failed to change password");
                      }
                    });
                  }}
                >
                  Update Password
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: "8px 12px", fontSize: 12 }}
                  onClick={() => { setShowPassword(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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

      {/* Org Branding Section — Admin only */}
      {isAdmin && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 16 }}>Branding</div>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Logo */}
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Organisation Logo</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 10, background: "#f3f4f6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid #e5e7eb", overflow: "hidden",
                }}>
                  {account.org?.logo_url ? (
                    <img src={account.org.logo_url} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: 24, fontWeight: 700, color: "#9ca3af" }}>
                      {(account.org?.name || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <label style={{
                    display: "inline-block", padding: "6px 14px", fontSize: 12, fontWeight: 600,
                    borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#374151",
                    cursor: uploadingLogo ? "not-allowed" : "pointer",
                  }}>
                    {uploadingLogo ? "Uploading..." : "Upload Logo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      style={{ display: "none" }}
                      disabled={uploadingLogo}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }
                        setUploadingLogo(true);
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          await uploadOrgLogo(fd);
                          toast.success("Logo uploaded");
                          router.refresh();
                        } catch (err: any) {
                          toast.error(err.message || "Upload failed");
                        } finally {
                          setUploadingLogo(false);
                        }
                      }}
                    />
                  </label>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>PNG, JPG, SVG, or WebP. Max 2MB.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Plan */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d8dce3", padding: 20, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Current Plan</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#111", textTransform: "capitalize" }}>{account.org?.plan || "Enterprise"}</span>
              {(account.org?.plan || "trial") === "trial" && account.org?.plan_expires_at && (
                <span style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>
                  Expires {new Date(account.org.plan_expires_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <a href="mailto:sales@complyva.com?subject=Plan%20Inquiry" style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#374151", textDecoration: "none" }}>Contact Sales</a>
        </div>
      </div>

      {/* Export Controls — Admin only */}
      {isAdmin && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d8dce3", padding: 20, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 4 }}>Data Export Controls</div>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16, marginTop: 0 }}>Choose which roles can export data (Excel and PDF reports).</p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {(["ADMIN", "AUDITOR", "VIEWER"] as const).map((role) => (
              <label key={role} style={{ display: "flex", alignItems: "center", gap: 6, cursor: role === "ADMIN" ? "default" : "pointer" }}>
                <input
                  type="checkbox"
                  checked={exportRoles.includes(role)}
                  disabled={role === "ADMIN"}
                  onChange={() => {
                    const next = exportRoles.includes(role) ? exportRoles.filter((r: string) => r !== role) : [...exportRoles, role];
                    setExportRoles(next);
                    updateAccount({ exportAllowedRoles: next });
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: role === "ADMIN" ? "#6b7280" : "#111" }}>{role}</span>
                {role === "ADMIN" && <span style={{ fontSize: 11, color: "#9ca3af" }}>(always allowed)</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Team Members Section */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d8dce3", padding: 20, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Team Members ({members.length})</div>
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
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Full name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                style={{
                  width: 160, padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db",
                  fontSize: 13, outline: "none",
                }}
              />
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
              The user will be added to your organisation with the selected role. Share your Complyva sign-up link with them — when they register with this email address, they&apos;ll automatically join your organisation. Their status will show as &quot;Pending Invite&quot; until they sign up.
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/sign-up`;
                  navigator.clipboard.writeText(url);
                  toast.success("Sign-up link copied!");
                }}
                style={{
                  padding: "4px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6,
                  border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer",
                }}
              >
                📋 Copy Sign-Up Link
              </button>
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
                        {m.status === "PENDING" && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: "#f59e0b", background: "#fffbeb",
                            border: "1px solid #fde68a", borderRadius: 10, padding: "1px 7px", marginLeft: 6,
                          }}>
                            PENDING INVITE
                          </span>
                        )}
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

      {/* Active Sessions */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d8dce3", padding: 20, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Active Sessions</div>
          {sessions.length > 1 && <button onClick={async () => { await revokeAllSessions(); window.location.reload(); }} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }}>Sign out all other sessions</button>}
        </div>
        {sessions.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af" }}>No active sessions found. Sessions are tracked from your next login.</div>}
        {sessions.map((s: any) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{s.device_info || "Unknown device"}{s.is_current && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", padding: "2px 8px", borderRadius: 10 }}>THIS DEVICE</span>}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>IP: {s.ip_address} · Last active: {new Date(s.last_active).toLocaleString()} · Since: {new Date(s.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
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

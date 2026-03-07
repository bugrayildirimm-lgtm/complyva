"use client";

/**
 * Conditionally renders children based on user role.
 * - `canEdit`: show for ADMIN and AUDITOR (hide for VIEWER)
 * - `adminOnly`: show only for ADMIN
 */
export function CanEdit({ role, children }: { role: string; children: React.ReactNode }) {
  if (role === "VIEWER") return null;
  return <>{children}</>;
}

export function AdminOnly({ role, children }: { role: string; children: React.ReactNode }) {
  if (role !== "ADMIN") return null;
  return <>{children}</>;
}

export function ViewerBanner({ role }: { role: string }) {
  if (role !== "VIEWER") return null;
  return (
    <div style={{
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      borderRadius: 8,
      padding: "8px 14px",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 12,
      color: "#1e40af",
    }}>
      <span style={{ fontSize: 14 }}>👁️</span>
      You have <strong>Viewer</strong> access. Editing is restricted. Contact an Admin to request elevated permissions.
    </div>
  );
}

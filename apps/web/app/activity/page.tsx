import { getActivity } from "../../lib/api";

const ACTION_ICONS: Record<string, string> = {
  CREATED: "🟢",
  UPLOADED: "📎",
  DELETED: "🔴",
  SIGNED_UP: "👤",
};

const ENTITY_LABELS: Record<string, string> = {
  CERTIFICATION: "Certification",
  RISK: "Risk",
  AUDIT: "Audit",
  FINDING: "Finding",
  EVIDENCE: "Evidence",
  USER: "User",
};

export default async function ActivityPage() {
  const logs = await getActivity();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity Log</h1>
          <p className="page-subtitle">Track all actions across your organisation</p>
        </div>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Action</th>
              <th>Item</th>
              <th>User</th>
              <th>Details</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log: any) => {
              const meta = log.meta ?? {};
              return (
                <tr key={log.id}>
                  <td style={{ textAlign: "center", fontSize: 16 }}>
                    {ACTION_ICONS[log.action] ?? "⚪"}
                  </td>
                  <td>
                    <span className={`badge badge-${log.action === "DELETED" ? "open" : log.action === "CREATED" ? "active" : "planned"}`}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 550, color: "#111" }}>{meta.name ?? "-"}</div>
                    <div style={{ fontSize: 11.5, color: "#9ca3af" }}>{ENTITY_LABELS[log.entity_type] ?? log.entity_type}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>{log.full_name || log.email || "-"}</td>
                  <td style={{ fontSize: 12, color: "#6b7280" }}>{meta.details ?? "-"}</td>
                  <td className="tabular" style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 32 }}>No activity yet. Create something to see it here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
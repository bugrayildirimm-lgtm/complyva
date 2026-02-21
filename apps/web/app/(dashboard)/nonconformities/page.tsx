import { createNonConformity, getNonConformities, getAssets } from "../../../lib/api";
import type { NonConformity, Asset } from "../../../lib/types";
import ExportButton from "../ExportButton";

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444", MAJOR: "#f59e0b", MINOR: "#3b82f6", OBSERVATION: "#22c55e",
};

export default async function NCsPage() {
  const rows: NonConformity[] = await getNonConformities();
  const assets: Asset[] = await getAssets();

  const openCount = rows.filter((n) => n.status !== "CLOSED").length;
  const overdueCount = rows.filter((n) => n.due_date && n.status !== "CLOSED" && new Date(n.due_date) < new Date()).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Non-Conformity Register</h1>
          <p className="page-subtitle">Track gaps, deviations, and non-conformances from standards</p>
        </div>
        <ExportButton type="nonconformities" />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#111" }}>Raise Non-Conformity</div>
        <form action={createNonConformity} className="form-grid">
          <div className="form-group form-full">
            <label className="form-label">NC Title</label>
            <input name="title" className="form-input" placeholder="Access control policy not enforced on staging environment" required />
          </div>
          <div className="form-group">
            <label className="form-label">Severity</label>
            <select name="severity" className="form-select" defaultValue="MINOR">
              <option value="OBSERVATION">Observation</option>
              <option value="MINOR">Minor</option>
              <option value="MAJOR">Major</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Source</label>
            <select name="sourceType" className="form-select" defaultValue="INTERNAL">
              <option value="AUDIT">Audit Finding</option>
              <option value="INCIDENT">Incident</option>
              <option value="CUSTOMER_COMPLAINT">Customer Complaint</option>
              <option value="INTERNAL">Internal Review</option>
              <option value="REGULATORY">Regulatory Inspection</option>
              <option value="SUPPLIER">Supplier Issue</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input name="category" className="form-input" placeholder="Access Control / Data Protection / ..." />
          </div>
          <div className="form-group">
            <label className="form-label">Linked Asset</label>
            <select name="assetId" className="form-select" defaultValue="">
              <option value="">None</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.asset_type})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Raised By</label>
            <input name="raisedBy" className="form-input" placeholder="Name or team" />
          </div>
          <div className="form-group">
            <label className="form-label">Assigned To</label>
            <input name="assignedTo" className="form-input" placeholder="Owner responsible for resolution" />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input name="dueDate" type="date" className="form-input" />
          </div>
          <div className="form-group form-full">
            <label className="form-label">Description</label>
            <textarea name="description" className="form-textarea" placeholder="Describe the non-conformity in detail..." />
          </div>
          <div className="form-full">
            <button type="submit" className="btn btn-primary">Raise NC</button>
          </div>
        </form>
      </div>

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {(["CRITICAL", "MAJOR", "MINOR", "OBSERVATION"] as const).map((sev) => {
          const count = rows.filter((n) => n.severity === sev && n.status !== "CLOSED").length;
          return (
            <div key={sev} className="card" style={{ padding: "12px 16px", textAlign: "center", borderLeft: `3px solid ${SEV_COLORS[sev]}` }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: SEV_COLORS[sev] }}>{count}</div>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>{sev} Open</div>
            </div>
          );
        })}
      </div>

      {/* Overdue Warning */}
      {overdueCount > 0 && (
        <div style={{
          background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 8,
          padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#991b1b",
        }}>
          🚨 <strong>{overdueCount}</strong> non-conformit{overdueCount > 1 ? "ies" : "y"} past due date
        </div>
      )}

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Severity</th>
              <th>Source</th>
              <th>Linked Asset</th>
              <th>Status</th>
              <th>Due Date</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => {
              const isOverdue = n.due_date && n.status !== "CLOSED" && new Date(n.due_date) < new Date();
              return (
                <tr key={n.id}>
                  <td>
                    <a href={`/nonconformities/${n.id}`} style={{ fontWeight: 550, color: "#111", textDecoration: "none" }}>
                      {n.title}
                    </a>
                    {n.category && <div style={{ fontSize: 11, color: "#6b7280" }}>{n.category}</div>}
                  </td>
                  <td>
                    <span style={{
                      display: "inline-block", padding: "2px 10px", borderRadius: 4,
                      fontSize: 11, fontWeight: 700, color: "#fff", background: SEV_COLORS[n.severity],
                    }}>{n.severity}</span>
                  </td>
                  <td><span className={`badge badge-${n.source_type.toLowerCase().replace(/_/g, "-")}`}>{n.source_type.replace(/_/g, " ")}</span></td>
                  <td style={{ fontSize: 13 }}>
                    {n.asset_name ? (
                      <a href={`/assets/${n.asset_id}`} style={{ color: "#2563eb", textDecoration: "none", fontSize: 12 }}>{n.asset_name}</a>
                    ) : "—"}
                  </td>
                  <td><span className={`badge badge-${n.status.toLowerCase().replace(/_/g, "-")}`}>{n.status.replace(/_/g, " ")}</span></td>
                  <td style={{ fontSize: 13, color: isOverdue ? "#ef4444" : "#111", fontWeight: isOverdue ? 600 : 400 }}>
                    {n.due_date ? String(n.due_date).slice(0, 10) : "—"}
                    {isOverdue && " ⚠"}
                  </td>
                  <td>
                    <a href={`/nonconformities/${n.id}`} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>Open →</a>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>❌</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>No non-conformities raised yet</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Non-conformities can be raised manually or created from incidents and audit findings. Use the form above to get started.</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

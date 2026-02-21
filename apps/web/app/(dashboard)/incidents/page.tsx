import { createIncident, getIncidents, getAssets , getCurrentRole } from "../../../lib/api";
import type { Incident, Asset } from "../../../lib/types";
import ExportButton from "../ExportButton";

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f59e0b", MEDIUM: "#3b82f6", LOW: "#22c55e",
};

export default async function IncidentsPage() {
  const rows: Incident[] = await getIncidents();
  const assets: Asset[] = await getAssets();

  const role = await getCurrentRole();
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Incident Log</h1>
          <p className="page-subtitle">Track, investigate, and resolve security and operational incidents</p>
        </div>
        <ExportButton type="incidents" />
      </div>

      {role !== "VIEWER" && (
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#111" }}>Report Incident</div>
        <form action={createIncident} className="form-grid">
          <div className="form-group form-full">
            <label className="form-label">Incident Title</label>
            <input name="title" className="form-input" placeholder="Unauthorized access detected on production server" required />
          </div>
          <div className="form-group">
            <label className="form-label">Severity</label>
            <select name="severity" className="form-select" defaultValue="MEDIUM">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input name="category" className="form-input" placeholder="Security / Operational / Data Breach..." />
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
            <label className="form-label">Incident Date</label>
            <input name="incidentDate" type="date" className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Detected Date</label>
            <input name="detectedDate" type="date" className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Reported By</label>
            <input name="reportedBy" className="form-input" placeholder="Name or team" />
          </div>
          <div className="form-group">
            <label className="form-label">Assigned To</label>
            <input name="assignedTo" className="form-input" placeholder="Investigator / team" />
          </div>
          <div className="form-group form-full">
            <label className="form-label">Description</label>
            <textarea name="description" className="form-textarea" placeholder="What happened? Include initial observations..." />
          </div>
          <div className="form-full">
            <button type="submit" className="btn btn-primary">Report Incident</button>
          </div>
        </form>
      </div>
      )}

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => {
          const count = rows.filter((i) => i.severity === sev && i.status !== "CLOSED").length;
          return (
            <div key={sev} className="card" style={{ padding: "12px 16px", textAlign: "center", borderLeft: `3px solid ${SEV_COLORS[sev]}` }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: SEV_COLORS[sev] }}>{count}</div>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>{sev} Open</div>
            </div>
          );
        })}
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Severity</th>
              <th>Category</th>
              <th>Linked Asset</th>
              <th>Status</th>
              <th>Incident Date</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>
                  <a href={`/incidents/${i.id}`} style={{ fontWeight: 550, color: "#111", textDecoration: "none" }}>
                    {i.title}
                  </a>
                </td>
                <td>
                  <span style={{
                    display: "inline-block", padding: "2px 10px", borderRadius: 4,
                    fontSize: 11, fontWeight: 700, color: "#fff",
                    background: SEV_COLORS[i.severity],
                  }}>
                    {i.severity}
                  </span>
                </td>
                <td style={{ fontSize: 13 }}>{i.category || "—"}</td>
                <td style={{ fontSize: 13 }}>
                  {i.asset_name ? (
                    <a href={`/assets/${i.asset_id}`} style={{ color: "#2563eb", textDecoration: "none", fontSize: 12 }}>
                      {i.asset_name}
                    </a>
                  ) : "—"}
                </td>
                <td><span className={`badge badge-${i.status.toLowerCase().replace(/_/g, "-")}`}>{i.status.replace(/_/g, " ")}</span></td>
                <td style={{ fontSize: 13 }}>{i.incident_date ? String(i.incident_date).slice(0, 10) : "—"}</td>
                <td>
                  <a href={`/incidents/${i.id}`} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>Open →</a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🚨</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>No incidents reported yet</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>When incidents occur, log them here to track investigation, root cause analysis, and resolution.</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

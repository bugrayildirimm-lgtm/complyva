import { createCAPA, getCAPAs, getAssets } from "../../../lib/api";
import type { CAPA, Asset } from "../../../lib/types";
import ExportButton from "../ExportButton";

const PRIO_COLORS: Record<string, string> = { CRITICAL: "#ef4444", HIGH: "#f59e0b", MEDIUM: "#3b82f6", LOW: "#22c55e" };
const TYPE_COLORS: Record<string, string> = { CORRECTIVE: "#ef4444", PREVENTIVE: "#3b82f6", CORRECTION: "#f59e0b" };

function capaId(year: string, num: number) {
  return `CAPA-${year}-${String(num).padStart(3, "0")}`;
}

export default async function CAPAsPage() {
  const rows: CAPA[] = await getCAPAs();
  const assets: Asset[] = await getAssets();

  const openStatuses = ["OPEN", "UNDER_INVESTIGATION", "ACTION_DEFINED", "IN_PROGRESS", "PENDING_VERIFICATION", "REOPENED"];
  const openCount = rows.filter((c) => openStatuses.includes(c.status)).length;
  const overdueCount = rows.filter((c) => c.due_date && openStatuses.includes(c.status) && new Date(c.due_date) < new Date()).length;
  const correctiveCount = rows.filter((c) => c.capa_type === "CORRECTIVE" && openStatuses.includes(c.status)).length;
  const preventiveCount = rows.filter((c) => c.capa_type === "PREVENTIVE" && openStatuses.includes(c.status)).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">CAPA Log</h1>
          <p className="page-subtitle">Corrective, Preventive & Correction Actions — fix issues and prevent recurrence</p>
        </div>
        <ExportButton type="capas" />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#111" }}>Create CAPA</div>
        <form action={createCAPA} className="form-grid">
          <div className="form-group form-full">
            <label className="form-label">CAPA Title</label>
            <input name="title" className="form-input" placeholder="Implement automated access review process" required />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select name="capaType" className="form-select" defaultValue="CORRECTIVE">
              <option value="CORRECTIVE">Corrective — Fix root cause</option>
              <option value="PREVENTIVE">Preventive — Prevent future occurrence</option>
              <option value="CORRECTION">Correction — Immediate fix only</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select name="priority" className="form-select" defaultValue="MEDIUM">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Source</label>
            <select name="sourceType" className="form-select" defaultValue="">
              <option value="">Not linked</option>
              <option value="INTERNAL_AUDIT">Internal Audit</option>
              <option value="EXTERNAL_AUDIT">External Audit</option>
              <option value="INCIDENT">Incident</option>
              <option value="COMPLAINT">Customer Complaint</option>
              <option value="MONITORING">Monitoring / Metrics</option>
              <option value="RISK_ASSESSMENT">Risk Assessment</option>
              <option value="REGULATORY">Regulatory Finding</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Root Cause Category</label>
            <select name="rootCauseCategory" className="form-select" defaultValue="">
              <option value="">Not assessed</option>
              <option value="PEOPLE">People</option>
              <option value="PROCESS">Process</option>
              <option value="TECHNOLOGY">Technology</option>
              <option value="THIRD_PARTY">Third-party</option>
              <option value="EXTERNAL_REGULATORY">External / Regulatory</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Analysis Method</label>
            <select name="analysisMethod" className="form-select" defaultValue="">
              <option value="">Not selected</option>
              <option value="FIVE_WHYS">5 Whys</option>
              <option value="FISHBONE">Fishbone (Ishikawa)</option>
              <option value="FAULT_TREE">Fault Tree Analysis</option>
              <option value="TREND_ANALYSIS">Trend Analysis</option>
            </select>
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
            <input name="assignedTo" className="form-input" placeholder="Action owner" />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input name="dueDate" type="date" className="form-input" />
          </div>
          <div className="form-group form-full">
            <label className="form-label">Action Plan</label>
            <textarea name="actionPlan" className="form-textarea" placeholder="What specific actions will be taken?" />
          </div>
          <div className="form-group form-full">
            <label className="form-label">Description / Background</label>
            <textarea name="description" className="form-textarea" placeholder="What happened, when detected, detection source..." />
          </div>
          <div className="form-full">
            <button type="submit" className="btn btn-primary">Create CAPA</button>
          </div>
        </form>
      </div>

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: "12px 16px", textAlign: "center", borderLeft: "3px solid #ef4444" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444" }}>{correctiveCount}</div>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Corrective Open</div>
        </div>
        <div className="card" style={{ padding: "12px 16px", textAlign: "center", borderLeft: "3px solid #3b82f6" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{preventiveCount}</div>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Preventive Open</div>
        </div>
        <div className="card" style={{ padding: "12px 16px", textAlign: "center", borderLeft: "3px solid #f59e0b" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: overdueCount > 0 ? "#ef4444" : "#22c55e" }}>{overdueCount}</div>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Overdue</div>
        </div>
        <div className="card" style={{ padding: "12px 16px", textAlign: "center", borderLeft: "3px solid #22c55e" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#22c55e" }}>{rows.filter((c) => c.status === "CLOSED" && c.effectiveness_status === "EFFECTIVE").length}</div>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Verified Effective</div>
        </div>
      </div>

      {overdueCount > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>
          🚨 <strong>{overdueCount}</strong> CAPA{overdueCount > 1 ? "s" : ""} past due date
        </div>
      )}

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>CAPA ID</th>
              <th>Title</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Root Cause</th>
              <th>Status</th>
              <th>Due Date</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const isOverdue = c.due_date && openStatuses.includes(c.status) && new Date(c.due_date) < new Date();
              const year = String(c.created_at).slice(0, 4);
              return (
                <tr key={c.id}>
                  <td style={{ fontSize: 12, fontWeight: 600, fontFamily: "monospace", color: "#6b7280" }}>
                    {capaId(year, c.capa_number)}
                  </td>
                  <td>
                    <a href={`/capas/${c.id}`} style={{ fontWeight: 550, color: "#111", textDecoration: "none" }}>{c.title}</a>
                  </td>
                  <td>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, color: "#fff", background: TYPE_COLORS[c.capa_type] }}>{c.capa_type}</span>
                  </td>
                  <td>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, color: "#fff", background: PRIO_COLORS[c.priority] }}>{c.priority}</span>
                  </td>
                  <td style={{ fontSize: 12, color: "#6b7280" }}>{c.root_cause_category ? c.root_cause_category.replace(/_/g, " ") : "—"}</td>
                  <td><span className={`badge badge-${c.status.toLowerCase().replace(/_/g, "-")}`}>{c.status.replace(/_/g, " ")}</span></td>
                  <td style={{ fontSize: 13, color: isOverdue ? "#ef4444" : "#111", fontWeight: isOverdue ? 600 : 400 }}>
                    {c.due_date ? String(c.due_date).slice(0, 10) : "—"}{isOverdue && " ⚠"}
                  </td>
                  <td><a href={`/capas/${c.id}`} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>Open →</a></td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>No CAPAs created yet</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>CAPAs track corrective and preventive actions. Create one above or generate from a non-conformity.</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

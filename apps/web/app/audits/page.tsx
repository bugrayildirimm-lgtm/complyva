import { createAudit, getAudits } from "../../lib/api";
import type { Audit } from "../../lib/types";

export default async function AuditsPage() {
  const rows: Audit[] = await getAudits();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audits</h1>
          <p className="page-subtitle">Audit engagements and findings</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#111" }}>Add Audit</div>
        <form action={createAudit} className="form-grid">
          <div className="form-group">
            <label className="form-label">Type</label>
            <select name="type" className="form-select" defaultValue="INTERNAL">
              <option value="INTERNAL">Internal</option>
              <option value="EXTERNAL">External</option>
              <option value="CERTIFICATION">Certification</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select name="status" className="form-select" defaultValue="PLANNED">
              <option value="PLANNED">Planned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="form-group form-full">
            <label className="form-label">Title</label>
            <input name="title" className="form-input" placeholder="Q1 internal audit" required />
          </div>
          <div className="form-group">
            <label className="form-label">Auditor</label>
            <input name="auditor" className="form-input" placeholder="Internal / External lab" />
          </div>
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input name="startDate" type="date" className="form-input" />
          </div>
          <div className="form-group form-full">
            <label className="form-label">Scope</label>
            <textarea name="scope" className="form-textarea" placeholder="ISMS controls testing..." />
          </div>
          <div className="form-full">
            <button type="submit" className="btn btn-primary">Create Audit</button>
          </div>
        </form>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Audit</th>
              <th>Type</th>
              <th>Status</th>
              <th>Start Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td><span className={`badge badge-${a.type.toLowerCase()}`}>{a.type}</span></td>
                <td><span className={`badge badge-${a.status.toLowerCase()}`}>{a.status.replace(/_/g, " ")}</span></td>
                <td className="tabular">{a.start_date ? String(a.start_date).slice(0, 10) : "-"}</td>
                <td><a href={`/audits/${a.id}`} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>View Findings</a></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="muted">No audits yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
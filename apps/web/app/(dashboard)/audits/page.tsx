import { createAudit, getAudits, getEvidence, uploadEvidence, deleteEvidence } from "../../../lib/api";
import type { Audit } from "../../../lib/types";
import EvidencePanel from "../EvidencePanel";

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

      {rows.map(async (a) => {
        const files = await getEvidence("AUDIT", a.id);
        return (
          <div key={a.id} className="table-card" style={{ marginBottom: 16, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{a.title}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                  {a.start_date ? String(a.start_date).slice(0, 10) : "-"} · {a.auditor ?? "-"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className={`badge badge-${a.type.toLowerCase()}`}>{a.type}</span>
                <span className={`badge badge-${a.status.toLowerCase()}`}>{a.status.replace(/_/g, " ")}</span>
                <a href={`/audits/${a.id}`} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>Findings</a>
              </div>
            </div>
            <EvidencePanel
              entityType="AUDIT"
              entityId={a.id}
              files={files}
              uploadAction={uploadEvidence}
              deleteAction={deleteEvidence}
            />
          </div>
        );
      })}

      {rows.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div className="muted">No audits yet. Create one above.</div>
        </div>
      )}
    </>
  );
}
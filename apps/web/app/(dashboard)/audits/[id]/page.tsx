import { createFinding, getFindings, getEvidence, uploadEvidence, deleteEvidence } from "../../../../lib/api";
import type { Finding } from "../../../../lib/types";
import EvidencePanel from "../../EvidencePanel";

export default async function AuditFindingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: auditId } = await params;
  const rows: Finding[] = await getFindings(auditId);

  async function action(formData: FormData) {
    "use server";
    await createFinding(auditId, formData);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Findings</h1>
          <p className="page-subtitle">Audit ID: {auditId}</p>
        </div>
        <a href="/audits" className="btn btn-secondary">Back to Audits</a>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#111" }}>Add Finding</div>
        <form action={action} className="form-grid">
          <div className="form-group form-full">
            <label className="form-label">Title</label>
            <input name="title" className="form-input" placeholder="Access reviews not evidenced" required />
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
            <label className="form-label">Due Date</label>
            <input name="dueDate" type="date" className="form-input" />
          </div>
          <div className="form-group form-full">
            <label className="form-label">Recommendation</label>
            <textarea name="recommendation" className="form-textarea" placeholder="What should be done?" />
          </div>
          <div className="form-full">
            <button type="submit" className="btn btn-primary">Create Finding</button>
          </div>
        </form>
      </div>

      {rows.map(async (f) => {
        const files = await getEvidence("FINDING", f.id);
        return (
          <div key={f.id} className="table-card" style={{ marginBottom: 16, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{f.title}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                  Due: {f.due_date ? String(f.due_date).slice(0, 10) : "-"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span className={`badge badge-${f.severity.toLowerCase()}`}>{f.severity}</span>
                <span className={`badge badge-${f.status.toLowerCase()}`}>{f.status.replace(/_/g, " ")}</span>
              </div>
            </div>
            <EvidencePanel
              entityType="FINDING"
              entityId={f.id}
              files={files}
              uploadAction={uploadEvidence}
              deleteAction={deleteEvidence}
            />
          </div>
        );
      })}

      {rows.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div className="muted">No findings yet. Create one above.</div>
        </div>
      )}
    </>
  );
}
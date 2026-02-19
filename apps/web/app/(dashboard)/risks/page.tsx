import { createRisk, getRisks, getEvidence, uploadEvidence, deleteEvidence } from "../../lib/api";
import type { Risk } from "../../lib/types";
import EvidencePanel from "../EvidencePanel";

export default async function RisksPage() {
  const rows: Risk[] = await getRisks();

  function scoreClass(score: number) {
    if (score >= 20) return "score-critical";
    if (score >= 10) return "score-high";
    if (score >= 5) return "score-medium";
    return "score-low";
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Risks</h1>
          <p className="page-subtitle">Risk register and treatment tracking</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#111" }}>Add Risk</div>
        <form action={createRisk} className="form-grid">
          <div className="form-group">
            <label className="form-label">Title</label>
            <input name="title" className="form-input" placeholder="Access logs not retained" required />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input name="category" className="form-input" placeholder="Logging" />
          </div>
          <div className="form-group">
            <label className="form-label">Likelihood (1-5)</label>
            <input name="likelihood" type="number" min={1} max={5} defaultValue={3} className="form-input" required />
          </div>
          <div className="form-group">
            <label className="form-label">Impact (1-5)</label>
            <input name="impact" type="number" min={1} max={5} defaultValue={3} className="form-input" required />
          </div>
          <div className="form-group form-full">
            <label className="form-label">Treatment Plan</label>
            <textarea name="treatmentPlan" className="form-textarea" placeholder="What will you do to reduce the risk?" />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input name="dueDate" type="date" className="form-input" />
          </div>
          <div className="form-full">
            <button type="submit" className="btn btn-primary">Create Risk</button>
          </div>
        </form>
      </div>

      {rows.map(async (r) => {
        const files = await getEvidence("RISK", r.id);
        return (
          <div key={r.id} className="table-card" style={{ marginBottom: 16, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{r.title}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                  {r.category ?? "-"} · L:{r.likelihood} × I:{r.impact} = <span className={`score-badge ${scoreClass(r.inherent_score)}`}>{r.inherent_score}</span>
                </div>
              </div>
              <span className={`badge badge-${r.status.toLowerCase()}`}>{r.status.replace(/_/g, " ")}</span>
            </div>
            <EvidencePanel
              entityType="RISK"
              entityId={r.id}
              files={files}
              uploadAction={uploadEvidence}
              deleteAction={deleteEvidence}
            />
          </div>
        );
      })}

      {rows.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div className="muted">No risks yet. Create one above.</div>
        </div>
      )}
    </>
  );
}
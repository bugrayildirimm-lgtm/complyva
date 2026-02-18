import { createRisk, getRisks } from "../../lib/api";
import type { Risk } from "../../lib/types";

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

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Risk</th>
              <th>Category</th>
              <th>L</th>
              <th>I</th>
              <th>Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.category ?? "-"}</td>
                <td className="tabular">{r.likelihood}</td>
                <td className="tabular">{r.impact}</td>
                <td><span className={`score-badge ${scoreClass(r.inherent_score)}`}>{r.inherent_score}</span></td>
                <td><span className={`badge badge-${r.status.toLowerCase()}`}>{r.status.replace(/_/g, " ")}</span></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="muted">No risks yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
import { createRisk, getRisks } from "../../../lib/api";
import type { Risk } from "../../../lib/types";
import RiskListClient from "./RiskListClient";

export default async function RisksPage() {
  const rows: Risk[] = await getRisks();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Risk Register</h1>
          <p className="page-subtitle">Risk register, treatment tracking, and approval workflow</p>
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

      <RiskListClient risks={rows} />
    </>
  );
}

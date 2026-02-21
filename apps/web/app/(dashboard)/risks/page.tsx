import { createRisk, getRisks } from "../../../lib/api";
import type { Risk } from "../../../lib/types";
import RiskListClient from "./RiskListClient";
import ExportButton from "../ExportButton";

export default async function RisksPage() {
  const rows: Risk[] = await getRisks();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Risk Register</h1>
          <p className="page-subtitle">3-factor risk scoring, treatment tracking, and approval workflow</p>
        </div>
        <ExportButton type="risks" />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#111" }}>Add Risk</div>
        <form action={createRisk} className="form-grid">
          <div className="form-group form-full">
            <label className="form-label">Title</label>
            <input name="title" className="form-input" placeholder="Access logs not retained for required period" required />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input name="category" className="form-input" placeholder="Logging / Data Protection / ..." />
          </div>
          <div className="form-group">
            <label className="form-label">Likelihood (1–5)</label>
            <select name="likelihood" className="form-select" defaultValue="3">
              <option value="1">1 — Rare</option>
              <option value="2">2 — Unlikely</option>
              <option value="3">3 — Possible</option>
              <option value="4">4 — Likely</option>
              <option value="5">5 — Almost Certain</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Impact (1–5)</label>
            <select name="impact" className="form-select" defaultValue="3">
              <option value="1">1 — Negligible</option>
              <option value="2">2 — Minor</option>
              <option value="3">3 — Moderate</option>
              <option value="4">4 — Major</option>
              <option value="5">5 — Severe</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Frequency (1–4)</label>
            <select name="frequency" className="form-select" defaultValue="">
              <option value="">Not assessed</option>
              <option value="1">1 — Annual or less</option>
              <option value="2">2 — Quarterly</option>
              <option value="3">3 — Monthly</option>
              <option value="4">4 — Weekly or more</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Control Effectiveness (1–4)</label>
            <select name="controlEffectiveness" className="form-select" defaultValue="">
              <option value="">Not assessed</option>
              <option value="1">1 — Strong (well designed & operating)</option>
              <option value="2">2 — Adequate (minor gaps)</option>
              <option value="3">3 — Weak (significant gaps)</option>
              <option value="4">4 — None (no controls in place)</option>
            </select>
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

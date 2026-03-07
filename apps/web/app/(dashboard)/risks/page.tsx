import { createRisk, getRisks, getCurrentRole } from "../../../lib/api";
import type { Risk } from "../../../lib/types";
import RiskListClient from "./RiskListClient";
import ExportButton from "../ExportButton";

function SectionStrip({ number, label, color }: { number: number; label: string; color: string }) {
  return (
    <div className="form-full" style={{
      background: color,
      margin: "18px -20px 12px -20px",
      padding: "10px 20px",
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}>
      <span style={{
        background: "#fff",
        color: color.replace("14", "40").replace("f0", "80"),
        fontWeight: 800,
        fontSize: 11,
        width: 22,
        height: 22,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>{number}</span>
      <span style={{
        fontSize: 12,
        fontWeight: 700,
        color: "#fff",
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
      }}>{label}</span>
    </div>
  );
}

function AutoNote({ children }: { children: string }) {
  return (
    <div className="form-group form-full" style={{
      background: "#f9fafb",
      border: "1px dashed #d1d5db",
      borderRadius: 6,
      padding: "8px 12px",
      fontSize: 11,
      color: "#6b7280",
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}>
      <span style={{ fontSize: 13 }}>⚡</span> {children}
    </div>
  );
}

export default async function RisksPage() {
  let rows: Risk[] = [];
  let role = "VIEWER";
  try {
    rows = await getRisks();
    role = await getCurrentRole();
  } catch (err: any) {
    throw new Error(`Risk page load failed: ${err?.message || err}`);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Risk Register</h1>
        </div>
        <ExportButton type="risks" />
      </div>

      {role !== "VIEWER" && (
      <div className="card" style={{ marginBottom: 16, padding: 20, overflow: "hidden" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#111" }}>Register New Risk</div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>Complete the sections below. Auto-calculated fields are computed on creation.</div>
        <form action={createRisk} className="form-grid">

          {/* ===== 1. RISK IDENTIFICATION ===== */}
          <SectionStrip number={1} label="Risk Identification" color="#374151" />
          <div className="form-group">
            <label className="form-label">RID #</label>
            <input name="ridNumber" className="form-input" placeholder="R-001" />
          </div>
          <div className="form-group">
            <label className="form-label">Risk Category</label>
            <input name="category" className="form-input" placeholder="Operational / Regulatory / Technical" />
          </div>
          <div className="form-group form-full">
            <label className="form-label">Risk Name *</label>
            <input name="title" className="form-input" placeholder="e.g. Inadequate access log retention" required />
          </div>
          <div className="form-group">
            <label className="form-label">Process Name</label>
            <input name="processName" className="form-input" placeholder="IT Operations" />
          </div>
          <div className="form-group">
            <label className="form-label">Sub-Process</label>
            <input name="subProcess" className="form-input" placeholder="Sub-process area" />
          </div>
          <div className="form-group">
            <label className="form-label">Risk Owner</label>
            <input name="riskOwner" className="form-input" placeholder="Name or role" />
          </div>
          <div className="form-group">
            <label className="form-label">Effectiveness of Existing Controls</label>
            <select name="controlEffectivenessDesc" className="form-select" defaultValue="">
              <option value="">Select...</option>
              <option value="Strong">1 — Strong</option>
              <option value="Reasonably Strong">2 — Reasonably Strong</option>
              <option value="Adequate">3 — Adequate</option>
              <option value="Insufficient">4 — Insufficient</option>
              <option value="Weak">5 — Weak / Non-Existent</option>
            </select>
          </div>
          <div className="form-group form-full">
            <label className="form-label">Risk Description</label>
            <textarea name="riskDescription" className="form-textarea" rows={2} placeholder="Description of the risk event and potential consequences" />
          </div>
          <div className="form-group form-full">
            <label className="form-label">Clarification</label>
            <textarea name="clarification" className="form-textarea" rows={2} placeholder="Additional context or clarification" />
          </div>
          <div className="form-group form-full">
            <label className="form-label">List Existing Controls</label>
            <textarea name="existingControls" className="form-textarea" rows={2} placeholder="Current controls in place" />
          </div>
          <div className="form-group">
            <label className="form-label">Opportunities</label>
            <input name="opportunities" className="form-input" placeholder="Positive opportunities from this risk" />
          </div>
          <div className="form-group">
            <label className="form-label">Target Benefit if Opportunity</label>
            <input name="targetBenefit" type="number" className="form-input" placeholder="€ amount" />
          </div>

          {/* ===== 2. INHERENT RISK ASSESSMENT ===== */}
          <SectionStrip number={2} label="Inherent Risk Assessment" color="#dc2626" />
          <div className="form-group">
            <label className="form-label">Impact</label>
            <select name="impactDesc" className="form-select" defaultValue="Moderate">
              <option value="Insignificant">1 — Insignificant</option>
              <option value="Minor">2 — Minor</option>
              <option value="Moderate">3 — Moderate</option>
              <option value="Major">4 — Major</option>
              <option value="Severe">5 — Severe</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Frequency</label>
            <select name="frequencyDesc" className="form-select" defaultValue="Possible">
              <option value="Rare">1 — Rare</option>
              <option value="Unlikely">2 — Unlikely</option>
              <option value="Possible">3 — Possible</option>
              <option value="Likely">4 — Likely</option>
              <option value="Certain">5 — Certain</option>
            </select>
          </div>
          <AutoNote>Risk Score, Inherent Risk Level, and Risk Strategy are auto-calculated.</AutoNote>

          {/* ===== 3. RESIDUAL RISK ASSESSMENT ===== */}
          <SectionStrip number={3} label="Residual Risk Assessment" color="#d97706" />
          <div className="form-group">
            <label className="form-label">Control Effectiveness</label>
            <select name="controlEffectivenessLabel" className="form-select" defaultValue="">
              <option value="">Not assessed</option>
              <option value="Strong">1 — Strong</option>
              <option value="Reasonably Strong">2 — Reasonably Strong</option>
              <option value="Adequate">3 — Adequate</option>
              <option value="Insufficient">4 — Insufficient</option>
              <option value="Weak">5 — Weak / Non-Existent</option>
            </select>
          </div>
          <AutoNote>Residual score is auto-calculated: Inherent Risk Score × Control Score.</AutoNote>

          {/* ===== 4. ACTION PLAN (TREATMENT) ===== */}
          <SectionStrip number={4} label="Action Plan" color="#2563eb" />
          <div className="form-group form-full">
            <label className="form-label">Proposed Actions</label>
            <textarea name="proposedActions" className="form-textarea" rows={2} placeholder="Actions to treat the risk" />
          </div>
          <div className="form-group">
            <label className="form-label">Deadline</label>
            <input name="deadline" type="date" className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Responsible</label>
            <input name="responsible" className="form-input" placeholder="Person or role" />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select name="status" className="form-select" defaultValue="OPEN">
              <option value="OPEN">Open / Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ON_HOLD">On Hold / Extended</option>
              <option value="OVERDUE">Overdue</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* ===== 5. MONITORING & REPORTING ===== */}
          <SectionStrip number={5} label="Monitoring & Reporting" color="#7c3aed" />
          <div className="form-group">
            <label className="form-label">Last Reviewed</label>
            <input name="lastReviewed" type="date" className="form-input" />
          </div>
          <AutoNote>Monitoring Period and Reporting escalation are auto-calculated based on risk level.</AutoNote>

          {/* ===== 6. COST-IMPACT CALCULATION ===== */}
          <SectionStrip number={6} label="Cost-Impact Calculation" color="#0f766e" />
          <div className="form-group">
            <label className="form-label">Min Cost</label>
            <input name="minCost" type="number" className="form-input" placeholder="€" />
          </div>
          <div className="form-group">
            <label className="form-label">Most Likely Cost</label>
            <input name="mostLikelyCost" type="number" className="form-input" placeholder="€" />
          </div>
          <div className="form-group">
            <label className="form-label">Max Cost</label>
            <input name="maxCost" type="number" className="form-input" placeholder="€" />
          </div>
          <AutoNote>Expected Value is auto-calculated using the PERT formula.</AutoNote>

          {/* ===== SUBMIT ===== */}
          <div className="form-full" style={{ marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ padding: "10px 32px", fontSize: 14 }}>Create Risk</button>
          </div>
        </form>
      </div>
      )}

      <RiskListClient risks={rows} />
    </>
  );
}

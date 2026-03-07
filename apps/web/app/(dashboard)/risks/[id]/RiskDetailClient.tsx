"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, InlineEdit, DeleteButton, StatusDropdown } from "../../ActionComponents";
import EvidencePanel from "../../EvidencePanel";
import LinkedItemsPanel from "../../LinkedItemsPanel";
import type { Risk } from "../../../../lib/types";

// ===== Scoring helpers =====
const IMPACT_MAP: Record<string, number> = { Insignificant: 1, Minor: 2, Moderate: 3, Major: 4, Severe: 5 };
const FREQ_MAP: Record<string, number> = { Rare: 1, Unlikely: 2, Possible: 3, Likely: 4, Certain: 5 };
const CTRL_MAP: Record<string, number> = { Strong: 1, "Reasonably Strong": 2, Adequate: 3, Insufficient: 4, Weak: 5 };

function riskLevel(score: number) {
  if (score > 18) return "Very High";
  if (score > 11) return "High";
  if (score > 7) return "Medium";
  if (score > 3) return "Low";
  if (score > 0) return "Very Low";
  return "—";
}
function levelColor(lvl: string) {
  if (lvl === "Very High") return { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" };
  if (lvl === "High") return { bg: "#fff7ed", border: "#fed7aa", text: "#ea580c" };
  if (lvl === "Medium") return { bg: "#fffbeb", border: "#fde68a", text: "#d97706" };
  if (lvl === "Low") return { bg: "#eff6ff", border: "#bfdbfe", text: "#2563eb" };
  return { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a" };
}
function riskLevelScore(lvl: string) {
  return lvl === "Very High" ? 5 : lvl === "High" ? 4 : lvl === "Medium" ? 3 : lvl === "Low" ? 2 : 1;
}
function strategyAuto(lvl: string) {
  const m: Record<string, string> = { "Very Low": "Accept", "Low": "Accept and Monitor", "Medium": "Reduce or Share (Transfer)", "High": "Reduce, Share, or Avoid", "Very High": "Avoid or Reduce aggressively" };
  return m[lvl] || "—";
}
function reportingAuto(lvl: string) {
  if (lvl === "Very High" || lvl === "High") return "Immediate Breach: Risk Committee/Board";
  if (lvl === "Medium") return "Escalate Residual Increase: Director Dept/Risk Committee";
  return "Trends KRI/KCI/Risk Limit: Risk Manager";
}
function monitorAuto(lvl: string) {
  const m: Record<string, string> = { "Very Low": "Review annually", "Low": "Review every 6 months", "Medium": "Review quarterly", "High": "Review monthly", "Very High": "Review weekly/continuously" };
  return m[lvl] || "—";
}

// Heat map cell
function heatCellColor(l: number, i: number) {
  const s = l * i;
  if (s >= 20) return { bg: "#ef4444", text: "#fff" };
  if (s >= 15) return { bg: "#f97316", text: "#fff" };
  if (s >= 10) return { bg: "#f59e0b", text: "#fff" };
  if (s >= 5) return { bg: "#fbbf24", text: "#111" };
  if (s >= 3) return { bg: "#a3e635", text: "#111" };
  return { bg: "#22c55e", text: "#fff" };
}

// ===== Styles =====
const sectionCard = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20, marginBottom: 16 };
const sectionTitle = (color: string) => ({ fontSize: 12, fontWeight: 700 as const, color, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid " + color + "30" });
const fieldLabel = { fontSize: 10, fontWeight: 600 as const, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 2 };
const fieldValue = { fontSize: 13, color: "#111", minHeight: 20 };
const autoTag = { fontSize: 9, fontWeight: 600 as const, color: "#6b7280", background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, marginLeft: 4, verticalAlign: "middle" as const };
const calcBox = (c: {bg: string, border: string, text: string}) => ({ background: c.bg, border: `2px solid ${c.border}`, borderRadius: 10, padding: "14px 18px", textAlign: "center" as const });

type Props = {
  risk: Risk;
  evidence: any[];
  activity: any[];
  crossLinks?: any;
  updateRisk: (id: string, data: Record<string, any>) => Promise<void>;
  deleteRisk: (id: string) => Promise<void>;
  uploadEvidence: (entityType: string, entityId: string, fd: FormData) => Promise<any>;
  deleteEvidence: (fileId: string) => Promise<any>;
  role: string;
  scoreHistory: any[];
};

// ===== Risk Heat Map with Snail Trail =====
function RiskHeatMapWithTrail({ risk, freqVal, impactVal, scoreHistory }: { risk: Risk; freqVal: number; impactVal: number; scoreHistory: any[] }) {
  const history = scoreHistory;

  const CELL = 80;
  const COLS = 5;
  const ROWS = 5;

  // Build trail points from history + current position
  // Each point: { likelihood, impact, label }
  const points: { l: number; i: number; label: string; date: string }[] = [];
  history.forEach((h, idx) => {
    const l = h.likelihood || freqVal;
    const imp = h.impact || impactVal;
    points.push({ l, i: imp, label: String(idx + 1), date: new Date(h.created_at).toLocaleDateString() });
  });
  // Current position (always last)
  points.push({ l: freqVal, i: impactVal, label: "★", date: "Now" });

  // Deduplicate consecutive identical positions
  const trail = points.filter((p, idx) => idx === 0 || p.l !== points[idx-1].l || p.i !== points[idx-1].i);

  // Cell center coords (SVG overlay)
  const cellCenter = (l: number, imp: number) => ({
    x: (l - 1) * CELL + CELL / 2,
    y: (ROWS - imp) * CELL + CELL / 2,
  });

  const svgW = COLS * CELL;
  const svgH = ROWS * CELL;

  return (
    <div style={{ padding: "20px 24px 24px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 16 }}>Risk Heat Map Position</div>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          {/* Column headers */}
          <div style={{ display: "flex", marginLeft: 32, marginBottom: 2 }}>
            {["Insignificant", "Minor", "Moderate", "Major", "Severe"].map((h, i) => (
              <div key={h} style={{ width: CELL, textAlign: "center", fontSize: 8, fontWeight: 600, color: "#6b7280" }}>{h}<br/>{i+1}</div>
            ))}
          </div>
          <div style={{ display: "flex" }}>
            {/* Row labels */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[5,4,3,2,1].map(f => (
                <div key={f} style={{ height: CELL, width: 32, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4, fontSize: 9, fontWeight: 600, color: "#6b7280" }}>{f}</div>
              ))}
            </div>
            {/* Grid + SVG overlay */}
            <div style={{ position: "relative", width: svgW, height: svgH }}>
              {/* Background cells */}
              {[5,4,3,2,1].map(freq => (
                <div key={freq} style={{ display: "flex", position: "absolute", top: (5-freq)*CELL, left: 0 }}>
                  {[1,2,3,4,5].map(imp => {
                    const c = heatCellColor(freq, imp);
                    return (
                      <div key={imp} style={{
                        width: CELL, height: CELL,
                        background: c.bg,
                        border: "1px solid rgba(255,255,255,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 600, color: c.text, opacity: 0.85,
                      }}>
                        {freq * imp}
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* SVG trail overlay */}
              <svg style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }} width={svgW} height={svgH}>
                <defs>
                  <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="rgba(0,0,0,0.7)" />
                  </marker>
                </defs>
                {/* Lines between points */}
                {trail.map((pt, idx) => {
                  if (idx === 0) return null;
                  const from = cellCenter(trail[idx-1].l, trail[idx-1].i);
                  const to = cellCenter(pt.l, pt.i);
                  // Shorten line so arrow doesn't overlap dot
                  const dx = to.x - from.x, dy = to.y - from.y;
                  const len = Math.sqrt(dx*dx + dy*dy) || 1;
                  const pad = 14;
                  return (
                    <line key={idx}
                      x1={from.x + dx/len*pad} y1={from.y + dy/len*pad}
                      x2={to.x - dx/len*pad} y2={to.y - dy/len*pad}
                      stroke="rgba(0,0,0,0.65)" strokeWidth={2} strokeDasharray="4 2"
                      markerEnd="url(#arrow)"
                    />
                  );
                })}
                {/* Dots */}
                {trail.map((pt, idx) => {
                  const { x, y } = cellCenter(pt.l, pt.i);
                  const isCurrent = idx === trail.length - 1;
                  return (
                    <g key={idx}>
                      <circle cx={x} cy={y} r={isCurrent ? 13 : 11}
                        fill={isCurrent ? "#111" : "#fff"}
                        stroke={isCurrent ? "#111" : "rgba(0,0,0,0.7)"}
                        strokeWidth={2}
                      />
                      <text x={x} y={y+1} textAnchor="middle" dominantBaseline="middle"
                        fontSize={isCurrent ? 10 : 9} fontWeight="700"
                        fill={isCurrent ? "#fff" : "#111"}
                      >
                        {pt.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
          {/* Legend */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10 }}>
            {[["#22c55e","Very Low"],["#a3e635","Low"],["#fbbf24","Medium"],["#f97316","High"],["#ef4444","Very High"]].map(([bg,label]) => (
              <div key={label} style={{ fontSize: 9, display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, display:"inline-block" }} /> {label}
              </div>
            ))}
          </div>
        </div>
        {/* Trail legend */}
        {trail.length > 1 && (
          <div style={{ minWidth: 160 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Score Journey</div>
            {trail.map((pt, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 11 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: idx === trail.length-1 ? "#111" : "#fff",
                  border: "2px solid #111",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700,
                  color: idx === trail.length-1 ? "#fff" : "#111",
                  flexShrink: 0,
                }}>{pt.label}</div>
                <div>
                  <div style={{ fontWeight: 600, color: "#111" }}>L{pt.l} × I{pt.i} = {pt.l * pt.i}</div>
                  <div style={{ color: "#9ca3af", fontSize: 10 }}>{pt.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {trail.length <= 1 && (
          <div style={{ fontSize: 12, color: "#9ca3af", alignSelf: "center" }}>
            No score changes recorded yet.<br/>The trail will appear as scores are updated.
          </div>
        )}
      </div>
    </div>
  );
}


export default function RiskDetailClient({ risk, evidence, activity, crossLinks, updateRisk, deleteRisk, uploadEvidence, deleteEvidence, role, scoreHistory }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const canEdit = role !== "VIEWER";

  const handleUpdate = (field: string, value: any) => {
    startTransition(async () => {
      await updateRisk(risk.id, { [field]: value });
      router.refresh();
    });
  };

  // Batch update for dropdowns that affect auto-calcs
  const handleAssessmentUpdate = (updates: Record<string, any>) => {
    startTransition(async () => {
      await updateRisk(risk.id, updates);
      router.refresh();
    });
  };

  const handleDelete = async () => {
    await deleteRisk(risk.id);
    router.push("/risks");
  };

  // Compute scores
  const impactVal = IMPACT_MAP[risk.impact_desc || ""] || risk.impact || 3;
  const freqVal = FREQ_MAP[risk.frequency_desc || ""] || risk.frequency || risk.likelihood || 3;
  const inherentScore = impactVal * freqVal;
  const inherentLevel = risk.inherent_risk_desc || riskLevel(inherentScore);
  const inherentLevelScore = riskLevelScore(inherentLevel);

  const ctrlVal = CTRL_MAP[risk.control_effectiveness_label || ""] || risk.control_score || 0;
  const residualRawScore = ctrlVal > 0 ? inherentLevelScore * ctrlVal : null;
  const residualLevel = residualRawScore ? riskLevel(residualRawScore) : null;

  const inherentC = levelColor(inherentLevel);
  const residualC = residualLevel ? levelColor(residualLevel) : { bg: "#f9fafb", border: "#e5e7eb", text: "#6b7280" };

  // Cost calcs
  const prob = risk.probability ?? (freqVal / 5);
  const mn = risk.min_cost ?? 0;
  const ml = risk.most_likely_cost ?? 0;
  const mx = risk.max_cost ?? 0;
  const pert = ml > 0 ? (mn + 4 * ml + mx) / 6 : 0;
  const expectedVal = ml > 0 ? prob * pert : null;

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 6 }}>
        <a href="/risks" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>← Back to Risk Register</a>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            {risk.rid_number && <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>{risk.rid_number}</span>}
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0 }}>{risk.title}</h1>
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            {risk.category || "Uncategorised"} · Inherent: {inherentScore} · {inherentLevel}
            {risk.risk_owner && <> · Owner: {risk.risk_owner}</>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusDropdown
            currentStatus={risk.status}
            options={["OPEN", "IN_PROGRESS", "ON_HOLD", "OVERDUE", "CLOSED"]}
            onStatusChange={async (s) => handleUpdate("status", s)}
          />
          {canEdit && <DeleteButton onDelete={handleDelete} />}
        </div>
      </div>

      {/* Score Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={calcBox(inherentC)}>
          <div style={{ fontSize: 10, fontWeight: 700, color: inherentC.text, textTransform: "uppercase", opacity: 0.8 }}>Inherent Risk</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: inherentC.text }}>{inherentScore}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: inherentC.text }}>{inherentLevel}</div>
          <div style={{ fontSize: 10, color: inherentC.text, opacity: 0.7, marginTop: 2 }}>Impact {impactVal} × Frequency {freqVal}</div>
        </div>
        <div style={calcBox(residualC)}>
          <div style={{ fontSize: 10, fontWeight: 700, color: residualC.text, textTransform: "uppercase", opacity: 0.8 }}>Residual Risk</div>
          {residualRawScore ? (
            <>
              <div style={{ fontSize: 32, fontWeight: 800, color: residualC.text }}>{residualRawScore}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: residualC.text }}>{residualLevel}</div>
              <div style={{ fontSize: 10, color: residualC.text, opacity: 0.7, marginTop: 2 }}>Inherent {inherentLevelScore} × Control {ctrlVal}</div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 8 }}>Set control effectiveness in Residual Risk tab</div>
          )}
        </div>
        <div style={{ ...calcBox({ bg: "#f8fafc", border: "#e2e8f0", text: "#334155" }) }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", textTransform: "uppercase", opacity: 0.8 }}>Strategy</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#334155", marginTop: 8 }}>{risk.risk_strategy || strategyAuto(inherentLevel)}</div>
          {expectedVal != null && expectedVal > 0 && (
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Expected cost: €{expectedVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={["Identification", "Inherent Risk", "Residual Risk", "Treatment", "Monitoring", "Cost-Impact", "Heat Map", "Evidence", "Linked Items", "Activity"]}>
        {/* ===== 1. RISK IDENTIFICATION ===== */}
        <div style={sectionCard}>
          <div style={sectionTitle("#374151")}>Risk Identification</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><div style={fieldLabel}>RID #</div>{canEdit ? <InlineEdit label="" name="ridNumber" value={risk.rid_number || ""} onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.rid_number || "—"}</div>}</div>
            <div><div style={fieldLabel}>Risk Category</div>{canEdit ? <InlineEdit label="" name="category" value={risk.category || ""} onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.category || "—"}</div>}</div>
            <div><div style={fieldLabel}>Risk Name</div>{canEdit ? <InlineEdit label="" name="title" value={risk.title || ""} onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.title || "—"}</div>}</div>
            <div><div style={fieldLabel}>Process Name</div>{canEdit ? <InlineEdit label="" name="processName" value={risk.process_name || ""} onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.process_name || "—"}</div>}</div>
            <div><div style={fieldLabel}>Sub-Process</div>{canEdit ? <InlineEdit label="" name="subProcess" value={risk.sub_process || ""} onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.sub_process || "—"}</div>}</div>
            <div><div style={fieldLabel}>Risk Owner</div>{canEdit ? <InlineEdit label="" name="riskOwner" value={risk.risk_owner || ""} onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.risk_owner || "—"}</div>}</div>
            <div style={{ gridColumn: "1 / -1" }}><div style={fieldLabel}>Risk Description</div>{canEdit ? <InlineEdit label="" name="riskDescription" value={risk.risk_description || risk.description || ""} type="textarea" onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.risk_description || risk.description || "—"}</div>}</div>
            <div style={{ gridColumn: "1 / -1" }}><div style={fieldLabel}>Clarification</div>{canEdit ? <InlineEdit label="" name="clarification" value={risk.clarification || ""} type="textarea" onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.clarification || "—"}</div>}</div>
            <div style={{ gridColumn: "1 / -1" }}><div style={fieldLabel}>Existing Controls</div>{canEdit ? <InlineEdit label="" name="existingControls" value={risk.existing_controls || ""} type="textarea" onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.existing_controls || "—"}</div>}</div>
            <div>
              <div style={fieldLabel}>Effectiveness of Existing Controls</div>
              {canEdit ? (
                <select value={risk.control_effectiveness_desc || ""} onChange={(e) => handleUpdate("controlEffectivenessDesc", e.target.value)} className="form-select" style={{ fontSize: 13 }}>
                  <option value="">Select...</option>
                  <option value="Strong">1 — Strong</option>
                  <option value="Reasonably Strong">2 — Reasonably Strong</option>
                  <option value="Adequate">3 — Adequate</option>
                  <option value="Insufficient">4 — Insufficient</option>
                  <option value="Weak">5 — Weak / Non-Existent</option>
                </select>
              ) : <div style={fieldValue}>{risk.control_effectiveness_desc || "—"}</div>}
            </div>
            <div><div style={fieldLabel}>Opportunities</div>{canEdit ? <InlineEdit label="" name="opportunities" value={risk.opportunities || ""} type="textarea" onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.opportunities || "—"}</div>}</div>
            <div><div style={fieldLabel}>Target Benefit (if Opportunity) €</div>{canEdit ? <InlineEdit label="" name="targetBenefit" value={risk.target_benefit != null ? String(risk.target_benefit) : ""} type="number" onSave={async (n, v) => handleUpdate(n, v ? Number(v) : null)} /> : <div style={fieldValue}>{risk.target_benefit != null ? String(risk.target_benefit) : "—"}</div>}</div>
          </div>
        </div>

        {/* ===== 2. INHERENT RISK ASSESSMENT ===== */}
        <div style={sectionCard}>
          <div style={sectionTitle("#dc2626")}>Inherent Risk Assessment</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={fieldLabel}>Impact Descriptor</div>
              {canEdit ? (
                <select value={risk.impact_desc || ""} onChange={(e) => {
                  const desc = e.target.value;
                  const val = IMPACT_MAP[desc] || 3;
                  const score = val * freqVal;
                  const lvl = riskLevel(score);
                  handleAssessmentUpdate({ impactDesc: desc, impact: val, inherentRiskDesc: lvl, riskStrategy: strategyAuto(lvl), reporting: reportingAuto(lvl), monitoringPeriod: monitorAuto(lvl) });
                }} className="form-select" style={{ fontSize: 13 }}>
                  <option value="">Select...</option>
                  <option value="Insignificant">1 — Insignificant</option>
                  <option value="Minor">2 — Minor</option>
                  <option value="Moderate">3 — Moderate</option>
                  <option value="Major">4 — Major</option>
                  <option value="Severe">5 — Severe</option>
                </select>
              ) : <div style={fieldValue}>{risk.impact_desc || "—"}</div>}
            </div>
            <div>
              <div style={fieldLabel}>Impact Score <span style={autoTag}>AUTO</span></div>
              <div style={{ ...fieldValue, fontWeight: 700, fontSize: 18 }}>{impactVal}</div>
            </div>
            <div>
              <div style={fieldLabel}>Frequency Descriptor</div>
              {canEdit ? (
                <select value={risk.frequency_desc || ""} onChange={(e) => {
                  const desc = e.target.value;
                  const val = FREQ_MAP[desc] || 3;
                  const score = impactVal * val;
                  const lvl = riskLevel(score);
                  handleAssessmentUpdate({ frequencyDesc: desc, frequency: val, likelihood: val, inherentRiskDesc: lvl, riskStrategy: strategyAuto(lvl), reporting: reportingAuto(lvl), monitoringPeriod: monitorAuto(lvl) });
                }} className="form-select" style={{ fontSize: 13 }}>
                  <option value="">Select...</option>
                  <option value="Rare">1 — Rare</option>
                  <option value="Unlikely">2 — Unlikely</option>
                  <option value="Possible">3 — Possible</option>
                  <option value="Likely">4 — Likely</option>
                  <option value="Certain">5 — Certain</option>
                </select>
              ) : <div style={fieldValue}>{risk.frequency_desc || "—"}</div>}
            </div>
            <div>
              <div style={fieldLabel}>Frequency Score <span style={autoTag}>AUTO</span></div>
              <div style={{ ...fieldValue, fontWeight: 700, fontSize: 18 }}>{freqVal}</div>
            </div>
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: 14, background: inherentC.bg, borderRadius: 8, border: `1px solid ${inherentC.border}` }}>
              <div style={{ textAlign: "center" }}>
                <div style={fieldLabel}>Risk Score <span style={autoTag}>AUTO</span></div>
                <div style={{ fontSize: 28, fontWeight: 800, color: inherentC.text }}>{inherentScore}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={fieldLabel}>Inherent Risk Score <span style={autoTag}>AUTO</span></div>
                <div style={{ fontSize: 28, fontWeight: 800, color: inherentC.text }}>{inherentLevelScore}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={fieldLabel}>Risk Level <span style={autoTag}>AUTO</span></div>
                <div style={{ fontSize: 16, fontWeight: 700, color: inherentC.text }}>{inherentLevel}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== 3. RESIDUAL RISK ASSESSMENT ===== */}
        <div style={sectionCard}>
          <div style={sectionTitle("#f59e0b")}>Residual Risk Assessment</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={fieldLabel}>Control Effectiveness</div>
              {canEdit ? (
                <select value={risk.control_effectiveness_label || ""} onChange={(e) => {
                  const label = e.target.value;
                  const score = CTRL_MAP[label] || 0;
                  handleAssessmentUpdate({
                    controlEffectivenessLabel: label || null,
                    controlScore: score > 0 ? score : null,
                  });
                }} className="form-select" style={{ fontSize: 13 }}>
                  <option value="">Select...</option>
                  <option value="Strong">1 — Strong</option>
                  <option value="Reasonably Strong">2 — Reasonably Strong</option>
                  <option value="Adequate">3 — Adequate</option>
                  <option value="Insufficient">4 — Insufficient</option>
                  <option value="Weak">5 — Weak / Non-Existent</option>
                </select>
              ) : <div style={fieldValue}>{risk.control_effectiveness_label || "—"}</div>}
            </div>
            <div>
              <div style={fieldLabel}>Control Score <span style={autoTag}>AUTO</span></div>
              <div style={{ ...fieldValue, fontWeight: 700, fontSize: 18 }}>{ctrlVal || "—"}</div>
            </div>
            {residualRawScore ? (
              <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: 14, background: residualC.bg, borderRadius: 8, border: `1px solid ${residualC.border}` }}>
                <div style={{ textAlign: "center" }}>
                  <div style={fieldLabel}>Residual Score <span style={autoTag}>AUTO</span></div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: residualC.text }}>{residualRawScore}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={fieldLabel}>Residual Risk Score <span style={autoTag}>AUTO</span></div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: residualC.text }}>{riskLevelScore(residualLevel!)}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={fieldLabel}>Residual Level <span style={autoTag}>AUTO</span></div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: residualC.text }}>{residualLevel}</div>
                </div>
              </div>
            ) : (
              <div style={{ gridColumn: "1 / -1", padding: 20, textAlign: "center", background: "#f9fafb", borderRadius: 8, color: "#9ca3af", fontSize: 13 }}>
                Select control effectiveness above to calculate residual risk.
              </div>
            )}
          </div>
        </div>

        {/* ===== 4. ACTION PLAN / TREATMENT ===== */}
        <div style={sectionCard}>
          <div style={sectionTitle("#2563eb")}>Action Plan (Treatment)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={fieldLabel}>Risk Strategy <span style={autoTag}>AUTO</span></div>
              <div style={fieldValue}>{risk.risk_strategy || strategyAuto(inherentLevel)}</div>
            </div>
            <div>
              <div style={fieldLabel}>Status</div>
              <div style={fieldValue}>{risk.status}</div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={fieldLabel}>Proposed Actions</div>
              {canEdit ? <InlineEdit label="" name="proposedActions" value={risk.proposed_actions || risk.treatment_plan || ""} type="textarea" onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.proposed_actions || risk.treatment_plan || "—"}</div>}
            </div>
            <div>
              <div style={fieldLabel}>Deadline</div>
              {canEdit ? <InlineEdit label="" name="deadline" value={risk.deadline || risk.due_date || ""} type="date" onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.deadline || risk.due_date || "—"}</div>}
            </div>
            <div>
              <div style={fieldLabel}>Responsible</div>
              {canEdit ? <InlineEdit label="" name="responsible" value={risk.responsible || ""} onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.responsible || "—"}</div>}
            </div>
          </div>
        </div>

        {/* ===== 5. MONITORING & REPORTING ===== */}
        <div style={sectionCard}>
          <div style={sectionTitle("#7c3aed")}>Monitoring & Reporting</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div>
              <div style={fieldLabel}>Monitoring Period <span style={autoTag}>AUTO</span></div>
              <div style={fieldValue}>{risk.monitoring_period || monitorAuto(residualLevel || inherentLevel)}</div>
            </div>
            <div>
              <div style={fieldLabel}>Reporting <span style={autoTag}>AUTO</span></div>
              <div style={fieldValue}>{risk.reporting || reportingAuto(inherentLevel)}</div>
            </div>
            <div>
              <div style={fieldLabel}>Last Reviewed</div>
              {canEdit ? <InlineEdit label="" name="lastReviewed" value={risk.last_reviewed || ""} type="date" onSave={async (n, v) => handleUpdate(n, v)} /> : <div style={fieldValue}>{risk.last_reviewed || "—"}</div>}
            </div>
          </div>
        </div>

        {/* ===== 6. COST-IMPACT CALCULATION ===== */}
        <div style={sectionCard}>
          <div style={sectionTitle("#0f766e")}>Cost-Impact Calculation</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
            <div>
              <div style={fieldLabel}>Probability <span style={autoTag}>AUTO</span></div>
              <div style={{ ...fieldValue, fontWeight: 700 }}>{(prob * 100).toFixed(0)}%</div>
              <div style={{ fontSize: 10, color: "#9ca3af" }}>Frequency / 5</div>
            </div>
            <div>
              <div style={fieldLabel}>Min Cost (€)</div>
              {canEdit ? <InlineEdit label="" name="minCost" value={risk.min_cost != null ? String(risk.min_cost) : ""} type="number" onSave={async (n, v) => handleUpdate(n, v ? Number(v) : null)} /> : <div style={fieldValue}>{risk.min_cost != null ? String(risk.min_cost) : "—"}</div>}
            </div>
            <div>
              <div style={fieldLabel}>Most Likely Cost (€)</div>
              {canEdit ? <InlineEdit label="" name="mostLikelyCost" value={risk.most_likely_cost != null ? String(risk.most_likely_cost) : ""} type="number" onSave={async (n, v) => handleUpdate(n, v ? Number(v) : null)} /> : <div style={fieldValue}>{risk.most_likely_cost != null ? String(risk.most_likely_cost) : "—"}</div>}
            </div>
            <div>
              <div style={fieldLabel}>Max Cost (€)</div>
              {canEdit ? <InlineEdit label="" name="maxCost" value={risk.max_cost != null ? String(risk.max_cost) : ""} type="number" onSave={async (n, v) => handleUpdate(n, v ? Number(v) : null)} /> : <div style={fieldValue}>{risk.max_cost != null ? String(risk.max_cost) : "—"}</div>}
            </div>
          </div>
          {expectedVal != null && expectedVal > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14, padding: 14, background: "#f0fdfa", borderRadius: 8, border: "1px solid #99f6e4" }}>
              <div style={{ textAlign: "center" }}>
                <div style={fieldLabel}>Expected Value (PERT) <span style={autoTag}>AUTO</span></div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0f766e" }}>€{expectedVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Probability × (Min + 4×ML + Max) / 6</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={fieldLabel}>Opportunity Impact <span style={autoTag}>AUTO</span></div>
                <div style={{ fontSize: 22, fontWeight: 800, color: risk.target_benefit ? "#0f766e" : "#9ca3af" }}>
                  {risk.target_benefit ? `€${((risk.target_benefit || 0) - expectedVal).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                </div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Target Benefit − Expected Value</div>
              </div>
            </div>
          )}
        </div>

        {/* ===== 7. HEAT MAP ===== */}
        <RiskHeatMapWithTrail risk={risk} freqVal={freqVal} impactVal={impactVal} scoreHistory={scoreHistory} />

        {/* ===== 8. EVIDENCE ===== */}
        <EvidencePanel
          entityType="RISK"
          entityId={risk.id}
          files={evidence}
          uploadAction={uploadEvidence}
          deleteAction={deleteEvidence}
          readOnly={!canEdit}
        />

        {/* ===== 9. LINKED ITEMS ===== */}
        {crossLinks ? <LinkedItemsPanel entityType="RISK" entityId={risk.id} links={crossLinks} /> : <div style={{ padding: 20, color: "#9ca3af", fontSize: 13 }}>No linked items.</div>}

        {/* ===== 10. ACTIVITY ===== */}
        <div className="card" style={{ padding: 16 }}>
          {activity.length === 0 ? (
            <div style={{ color: "#9ca3af", fontSize: 13 }}>No activity recorded yet.</div>
          ) : activity.map((a: any) => (
            <div key={a.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>
              <span style={{ color: "#9ca3af", whiteSpace: "nowrap" }}>{new Date(a.created_at).toLocaleString()}</span>
              <span style={{ fontWeight: 600, color: "#374151" }}>{a.action}</span>
              <span style={{ color: "#6b7280" }}>{a.details}</span>
            </div>
          ))}
        </div>
      </Tabs>
    </>
  );
}

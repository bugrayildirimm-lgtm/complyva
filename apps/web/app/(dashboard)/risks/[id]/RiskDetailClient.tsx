"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, InlineEdit, DeleteButton, StatusDropdown } from "../../ActionComponents";
import EvidencePanel from "../../EvidencePanel";
import LinkedItemsPanel from "../../LinkedItemsPanel";
import type { Risk } from "../../../../lib/types";

function scoreClass(score: number) {
  if (score >= 20) return "score-critical";
  if (score >= 10) return "score-high";
  if (score >= 5) return "score-medium";
  return "score-low";
}

function riskLevel(score: number) {
  if (score >= 20) return "VERY HIGH";
  if (score >= 15) return "HIGH";
  if (score >= 10) return "MEDIUM";
  if (score >= 5) return "LOW";
  return "VERY LOW";
}

function scoreColor(score: number) {
  if (score >= 20) return "#ef4444";
  if (score >= 15) return "#f59e0b";
  if (score >= 10) return "#eab308";
  if (score >= 5) return "#3b82f6";
  return "#22c55e";
}

// Heat map cell color based on L × I score
function heatCellColor(likelihood: number, impact: number) {
  const score = likelihood * impact;
  if (score >= 20) return { bg: "#ef4444", text: "#fff" };      // Critical — red
  if (score >= 15) return { bg: "#f97316", text: "#fff" };      // High — orange
  if (score >= 10) return { bg: "#f59e0b", text: "#fff" };      // Medium-High — amber
  if (score >= 5)  return { bg: "#fbbf24", text: "#111" };      // Medium — yellow
  if (score >= 3)  return { bg: "#a3e635", text: "#111" };      // Low-Medium — lime
  return { bg: "#4ade80", text: "#111" };                        // Low — green
}

const FREQ_LABELS: Record<number, string> = { 1: "Annual or less", 2: "Quarterly", 3: "Monthly", 4: "Weekly+" };
const CTRL_LABELS: Record<number, string> = { 1: "Strong", 2: "Adequate", 3: "Weak", 4: "None" };
const CTRL_COLORS: Record<number, string> = { 1: "#22c55e", 2: "#3b82f6", 3: "#f59e0b", 4: "#ef4444" };

const LIKELIHOOD_LABELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const IMPACT_LABELS = ["Negligible", "Minor", "Moderate", "Major", "Severe"];

export default function RiskDetailClient({
  risk,
  evidence,
  activity,
  crossLinks,
  updateRisk,
  deleteRisk,
  uploadEvidence,
  deleteEvidence,
  role,
}: {
  risk: Risk;
  evidence: any[];
  activity: any[];
  crossLinks: any[];
  updateRisk: (id: string, data: Record<string, any>) => Promise<void>;
  deleteRisk: (id: string) => Promise<void>;
  uploadEvidence: (entityType: string, entityId: string, formData: FormData) => Promise<any>;
  deleteEvidence: (fileId: string) => Promise<any>;
  role: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const canEdit = role !== "VIEWER";

  const handleSaveField = async (name: string, value: string) => {
    const numFields = ["likelihood", "impact", "frequency", "controlEffectiveness", "residualLikelihood", "residualImpact"];
    if (numFields.includes(name)) {
      if (!value || value === "") return;
      await updateRisk(risk.id, { [name]: Number(value) });
    } else {
      await updateRisk(risk.id, { [name]: value });
    }
    router.refresh();
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateRisk(risk.id, { status: newStatus });
    router.refresh();
  };

  const handleDelete = async () => {
    await deleteRisk(risk.id);
    router.push("/risks");
  };

  const inherentScore = risk.inherent_score || risk.likelihood * risk.impact;
  const residualScore = risk.residual_score || (risk.residual_likelihood && risk.residual_impact ? risk.residual_likelihood * risk.residual_impact : null);

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <a href="/risks" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>← Back to Risk Register</a>
          <h1 className="page-title" style={{ marginTop: 4 }}>{risk.title}</h1>
          <p className="page-subtitle">
            {risk.category || "Uncategorized"} · Inherent Score: {inherentScore} · {riskLevel(inherentScore)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusDropdown
            currentStatus={risk.status}
            options={["PENDING_REVIEW", "OPEN", "IN_TREATMENT", "ACCEPTED", "CLOSED", "REJECTED"]}
            onStatusChange={handleStatusChange}
          />
          {canEdit && <DeleteButton onDelete={handleDelete} />}
        </div>
      </div>

      {/* Scoring Summary — 3 cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Inherent Risk */}
        <div className="card" style={{ padding: "20px", borderTop: `3px solid ${scoreColor(inherentScore)}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 12 }}>
            Inherent Risk
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div className={`score-badge ${scoreClass(inherentScore)}`} style={{ fontSize: 28, padding: "8px 16px" }}>
                {inherentScore}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{riskLevel(inherentScore)}</div>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              <div>Likelihood: <strong style={{ color: "#111" }}>{risk.likelihood}</strong>/5</div>
              <div style={{ marginTop: 2 }}>Impact: <strong style={{ color: "#111" }}>{risk.impact}</strong>/5</div>
              <div style={{ marginTop: 2, fontSize: 11, color: "#9ca3af" }}>
                {risk.likelihood} × {risk.impact} = {inherentScore}
              </div>
            </div>
          </div>
        </div>

        {/* Control & Frequency */}
        <div className="card" style={{ padding: "20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 12 }}>
            Context Factors
          </div>
          <div style={{ fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ color: "#6b7280" }}>Frequency</span>
              {risk.frequency ? (
                <span style={{ fontWeight: 600, color: "#111" }}>{risk.frequency}/4 — {FREQ_LABELS[risk.frequency]}</span>
              ) : (
                <span style={{ color: "#9ca3af" }}>Not assessed</span>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#6b7280" }}>Control Effectiveness</span>
              {risk.control_effectiveness ? (
                <span style={{ fontWeight: 600, color: CTRL_COLORS[risk.control_effectiveness] }}>
                  {risk.control_effectiveness}/4 — {CTRL_LABELS[risk.control_effectiveness]}
                </span>
              ) : (
                <span style={{ color: "#9ca3af" }}>Not assessed</span>
              )}
            </div>
          </div>
          {risk.control_effectiveness && risk.control_effectiveness >= 3 && (
            <div style={{ marginTop: 12, padding: "6px 10px", background: "#fef2f2", borderRadius: 6, fontSize: 11, color: "#991b1b" }}>
              ⚠ Controls are {risk.control_effectiveness === 4 ? "absent" : "weak"} — treatment priority should be elevated
            </div>
          )}
        </div>

        {/* Residual Risk */}
        <div className="card" style={{ padding: "20px", borderTop: residualScore !== null ? `3px solid ${scoreColor(residualScore)}` : "3px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 12 }}>
            Residual Risk
          </div>
          {residualScore !== null ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "center" }}>
                <div className={`score-badge ${scoreClass(residualScore)}`} style={{ fontSize: 28, padding: "8px 16px" }}>
                  {residualScore}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{riskLevel(residualScore)}</div>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                <div>Likelihood: <strong style={{ color: "#111" }}>{risk.residual_likelihood}</strong>/5</div>
                <div style={{ marginTop: 2 }}>Impact: <strong style={{ color: "#111" }}>{risk.residual_impact}</strong>/5</div>
                {residualScore < inherentScore && (
                  <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: "#22c55e" }}>
                    ↓ {Math.round((1 - residualScore / inherentScore) * 100)}% reduction
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#9ca3af", padding: "12px 0" }}>
              Not assessed yet. Set residual scores in the Scoring tab.
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <Tabs tabs={["Details", "Scoring", "Heat Map", "Evidence", "Linked Items", "Activity"]}>
          {/* Details Tab */}
          <div>
            <InlineEdit label="Title" name="title" value={risk.title} onSave={handleSaveField} />
            <InlineEdit label="Description" name="description" value={risk.description || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="Category" name="category" value={risk.category || ""} onSave={handleSaveField} />
            <InlineEdit label="Treatment Plan" name="treatmentPlan" value={risk.treatment_plan || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="Due Date" name="dueDate" value={risk.due_date ? String(risk.due_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
          </div>

          {/* Scoring Tab */}
          <div>
            {/* Inherent */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 10 }}>Inherent Risk Scoring</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InlineEdit label="Likelihood (1–5): 1=Rare, 5=Almost Certain" name="likelihood" value={String(risk.likelihood)} type="select"
                  options={["1", "2", "3", "4", "5"]} onSave={handleSaveField} />
                <InlineEdit label="Impact (1–5): 1=Negligible, 5=Severe" name="impact" value={String(risk.impact)} type="select"
                  options={["1", "2", "3", "4", "5"]} onSave={handleSaveField} />
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
                Inherent Score = {risk.likelihood} × {risk.impact} = <strong style={{ color: scoreColor(inherentScore) }}>{inherentScore}</strong>
              </div>
            </div>

            {/* Context Factors */}
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 10 }}>Context Factors</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InlineEdit label="Frequency (1–4): 1=Annual, 4=Weekly+" name="frequency" value={risk.frequency ? String(risk.frequency) : ""} type="select"
                  options={["1", "2", "3", "4"]} onSave={handleSaveField} />
                <InlineEdit label="Control Effectiveness (1–4): 1=Strong, 4=None" name="controlEffectiveness" value={risk.control_effectiveness ? String(risk.control_effectiveness) : ""} type="select"
                  options={["1", "2", "3", "4"]} onSave={handleSaveField} />
              </div>
              <div style={{ marginTop: 8, padding: 12, background: "#f9fafb", borderRadius: 8, fontSize: 12, color: "#6b7280" }}>
                These factors provide additional context for risk prioritisation. Higher frequency and weaker controls indicate greater urgency for treatment.
              </div>
            </div>

            {/* Residual */}
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 10 }}>Residual Risk Scoring</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InlineEdit label="Residual Likelihood (1–5)" name="residualLikelihood"
                  value={risk.residual_likelihood ? String(risk.residual_likelihood) : ""} type="select"
                  options={["1", "2", "3", "4", "5"]} onSave={handleSaveField} />
                <InlineEdit label="Residual Impact (1–5)" name="residualImpact"
                  value={risk.residual_impact ? String(risk.residual_impact) : ""} type="select"
                  options={["1", "2", "3", "4", "5"]} onSave={handleSaveField} />
              </div>
            </div>

            {/* Visual Score Comparison */}
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 12 }}>Score Comparison</div>
              <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>INHERENT</div>
                  <div className={`score-badge ${scoreClass(inherentScore)}`} style={{ fontSize: 24, padding: "6px 14px" }}>
                    {inherentScore}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{riskLevel(inherentScore)}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 24, color: "#d1d5db" }}>→</div>
                  {risk.control_effectiveness && (
                    <div style={{ fontSize: 10, color: CTRL_COLORS[risk.control_effectiveness], fontWeight: 600 }}>
                      Controls: {CTRL_LABELS[risk.control_effectiveness]}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>RESIDUAL</div>
                  {residualScore !== null ? (
                    <>
                      <div className={`score-badge ${scoreClass(residualScore)}`} style={{ fontSize: 24, padding: "6px 14px" }}>
                        {residualScore}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{riskLevel(residualScore)}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 14, color: "#d1d5db", padding: "6px 14px" }}>—</div>
                  )}
                </div>
                {residualScore !== null && (
                  <div style={{ fontSize: 12, color: residualScore < inherentScore ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                    {residualScore < inherentScore
                      ? `↓ ${Math.round((1 - residualScore / inherentScore) * 100)}% reduction`
                      : residualScore === inherentScore
                        ? "No change"
                        : `↑ Increased`}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Heat Map Tab */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 16 }}>
              Risk Position — Likelihood vs Impact Matrix
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#111", border: "3px solid #111" }} />
                <span style={{ color: "#4b5563" }}>Inherent Risk</span>
              </div>
              {residualScore !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", border: "3px solid #3b82f6" }} />
                  <span style={{ color: "#4b5563" }}>Residual Risk</span>
                </div>
              )}
              {residualScore !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 20, height: 2, background: "#3b82f6", position: "relative" }}>
                    <div style={{ position: "absolute", right: -2, top: -3, width: 0, height: 0, borderLeft: "5px solid #3b82f6", borderTop: "4px solid transparent", borderBottom: "4px solid transparent" }} />
                  </div>
                  <span style={{ color: "#4b5563" }}>Treatment effect</span>
                </div>
              )}
            </div>

            {/* 5×5 Grid */}
            <div style={{ display: "flex", gap: 0 }}>
              {/* Y-axis label */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, marginRight: 4 }}>
                <div style={{ transform: "rotate(-90deg)", whiteSpace: "nowrap", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Impact
                </div>
              </div>

              {/* Y-axis scale + grid */}
              <div>
                <div style={{ display: "flex", gap: 0 }}>
                  {/* Y-axis values */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 0, marginRight: 4 }}>
                    {[5, 4, 3, 2, 1].map((impact) => (
                      <div key={impact} style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563" }}>{impact}</div>
                          <div style={{ fontSize: 9, color: "#9ca3af", lineHeight: 1 }}>{IMPACT_LABELS[impact - 1]}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Grid cells */}
                  <div>
                    {[5, 4, 3, 2, 1].map((impact) => (
                      <div key={impact} style={{ display: "flex", gap: 0 }}>
                        {[1, 2, 3, 4, 5].map((likelihood) => {
                          const cell = heatCellColor(likelihood, impact);
                          const score = likelihood * impact;
                          const isInherent = risk.likelihood === likelihood && risk.impact === impact;
                          const isResidual = risk.residual_likelihood === likelihood && risk.residual_impact === impact;
                          const isBoth = isInherent && isResidual;

                          return (
                            <div
                              key={likelihood}
                              style={{
                                width: 64, height: 64,
                                background: cell.bg,
                                display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center",
                                border: "1px solid rgba(255,255,255,0.3)",
                                position: "relative",
                                opacity: (isInherent || isResidual) ? 1 : 0.65,
                              }}
                            >
                              {/* Score number */}
                              <div style={{ fontSize: 13, fontWeight: 700, color: cell.text, opacity: 0.5 }}>
                                {score}
                              </div>

                              {/* Inherent marker */}
                              {isInherent && !isBoth && (
                                <div style={{
                                  position: "absolute", top: 4, right: 4,
                                  width: 18, height: 18, borderRadius: "50%",
                                  background: "#111", display: "flex", alignItems: "center", justifyContent: "center",
                                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                                }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>I</span>
                                </div>
                              )}

                              {/* Residual marker */}
                              {isResidual && !isBoth && (
                                <div style={{
                                  position: "absolute", bottom: 4, left: 4,
                                  width: 18, height: 18, borderRadius: "50%",
                                  background: "#fff", border: "3px solid #3b82f6",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                                }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: "#3b82f6" }}>R</span>
                                </div>
                              )}

                              {/* Both in same cell */}
                              {isBoth && (
                                <div style={{
                                  position: "absolute", top: 4, right: 4,
                                  width: 18, height: 18, borderRadius: "50%",
                                  background: "#111", border: "2px solid #3b82f6",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                                }}>
                                  <span style={{ fontSize: 8, fontWeight: 700, color: "#fff" }}>I+R</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}

                    {/* X-axis values */}
                    <div style={{ display: "flex", gap: 0, marginTop: 4 }}>
                      {[1, 2, 3, 4, 5].map((likelihood) => (
                        <div key={likelihood} style={{ width: 64, textAlign: "center" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563" }}>{likelihood}</div>
                          <div style={{ fontSize: 9, color: "#9ca3af" }}>{LIKELIHOOD_LABELS[likelihood - 1]}</div>
                        </div>
                      ))}
                    </div>

                    {/* X-axis label */}
                    <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Likelihood
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Score Summary underneath */}
            <div style={{ marginTop: 24, display: "flex", gap: 24 }}>
              <div style={{ padding: "12px 16px", background: "#f9fafb", borderRadius: 8, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Inherent Position</div>
                <div style={{ fontSize: 14, color: "#111" }}>
                  Likelihood <strong>{risk.likelihood}</strong> × Impact <strong>{risk.impact}</strong> = <strong style={{ color: scoreColor(inherentScore) }}>{inherentScore}</strong>
                  <span style={{ marginLeft: 8, fontSize: 12, color: scoreColor(inherentScore), fontWeight: 600 }}>{riskLevel(inherentScore)}</span>
                </div>
              </div>
              {residualScore !== null && (
                <div style={{ padding: "12px 16px", background: "#f9fafb", borderRadius: 8, flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Residual Position</div>
                  <div style={{ fontSize: 14, color: "#111" }}>
                    Likelihood <strong>{risk.residual_likelihood}</strong> × Impact <strong>{risk.residual_impact}</strong> = <strong style={{ color: scoreColor(residualScore) }}>{residualScore}</strong>
                    <span style={{ marginLeft: 8, fontSize: 12, color: scoreColor(residualScore), fontWeight: 600 }}>{riskLevel(residualScore)}</span>
                    {residualScore < inherentScore && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: "#22c55e", fontWeight: 600 }}>
                        ↓ {Math.round((1 - residualScore / inherentScore) * 100)}% reduction
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Evidence Tab */}
          <div>
            <EvidencePanel
              entityType="RISK"
              entityId={risk.id}
              files={evidence}
              uploadAction={uploadEvidence}
              deleteAction={deleteEvidence}
              readOnly={!canEdit}
            />
          </div>

          {/* Linked Items Tab */}
          <div>
            <LinkedItemsPanel entityType="RISK" entityId={risk.id} links={crossLinks} />
          </div>

          {/* Activity Tab */}
          <div>
            {activity.map((a: any) => (
              <div key={a.id} style={{
                padding: "10px 0", borderBottom: "1px solid #f3f4f6",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{a.action}</span>
                  <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>by {a.full_name || a.email || "System"}</span>
                </div>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{new Date(a.created_at).toLocaleString()}</span>
              </div>
            ))}
            {activity.length === 0 && (
              <div style={{ textAlign: "center", padding: 24, color: "#9ca3af", fontSize: 13 }}>No activity yet.</div>
            )}
          </div>
        </Tabs>
      </div>
    </>
  );
}

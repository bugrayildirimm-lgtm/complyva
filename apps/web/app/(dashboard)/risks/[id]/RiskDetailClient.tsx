"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, InlineEdit, DeleteButton, StatusDropdown } from "../../ActionComponents";
import EvidencePanel from "../../EvidencePanel";
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

const FREQ_LABELS: Record<number, string> = { 1: "Annual or less", 2: "Quarterly", 3: "Monthly", 4: "Weekly+" };
const CTRL_LABELS: Record<number, string> = { 1: "Strong", 2: "Adequate", 3: "Weak", 4: "None" };
const CTRL_COLORS: Record<number, string> = { 1: "#22c55e", 2: "#3b82f6", 3: "#f59e0b", 4: "#ef4444" };

export default function RiskDetailClient({
  risk,
  evidence,
  activity,
  updateRisk,
  deleteRisk,
  uploadEvidence,
  deleteEvidence,
}: {
  risk: Risk;
  evidence: any[];
  activity: any[];
  updateRisk: (id: string, data: Record<string, any>) => Promise<void>;
  deleteRisk: (id: string) => Promise<void>;
  uploadEvidence: (entityType: string, entityId: string, formData: FormData) => Promise<any>;
  deleteEvidence: (fileId: string) => Promise<any>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
          <DeleteButton onDelete={handleDelete} />
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
        <Tabs tabs={["Details", "Scoring", "Evidence", "Activity"]}>
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

          {/* Evidence Tab */}
          <div>
            <EvidencePanel
              entityType="RISK"
              entityId={risk.id}
              files={evidence}
              uploadAction={uploadEvidence}
              deleteAction={deleteEvidence}
            />
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

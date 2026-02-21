"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Risk } from "../../../lib/types";
import { updateRisk } from "../../../lib/api";

const STATUS_TABS = [
  { key: "PENDING_REVIEW", label: "⏳ Pending Review" },
  { key: "OPEN", label: "Open" },
  { key: "IN_TREATMENT", label: "In Treatment" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "CLOSED", label: "Closed" },
  { key: "ALL", label: "All" },
  { key: "HEATMAP", label: "🔥 Heat Map" },
];

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

function heatCellColor(likelihood: number, impact: number) {
  const score = likelihood * impact;
  if (score >= 20) return { bg: "#ef4444", text: "#fff" };
  if (score >= 15) return { bg: "#f97316", text: "#fff" };
  if (score >= 10) return { bg: "#f59e0b", text: "#fff" };
  if (score >= 5)  return { bg: "#fbbf24", text: "#111" };
  if (score >= 3)  return { bg: "#a3e635", text: "#111" };
  return { bg: "#4ade80", text: "#111" };
}

const LIKELIHOOD_LABELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const IMPACT_LABELS = ["Negligible", "Minor", "Moderate", "Major", "Severe"];

// --- Heat Map Tab Content ---
function HeatMapView({ risks }: { risks: Risk[] }) {
  const [view, setView] = useState<"inherent" | "residual">("inherent");

  const activeRisks = risks.filter((r) => !["CLOSED", "REJECTED"].includes(r.status));

  const grid: Map<string, Risk[]> = new Map();
  for (const r of activeRisks) {
    let l: number | null, i: number | null;
    if (view === "inherent") {
      l = r.likelihood;
      i = r.impact;
    } else {
      l = r.residual_likelihood;
      i = r.residual_impact;
    }
    if (l && i) {
      const key = `${l}-${i}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(r);
    }
  }

  const residualCount = activeRisks.filter((r) => r.residual_likelihood && r.residual_impact).length;
  const totalOnMap = view === "inherent" ? activeRisks.length : residualCount;

  return (
    <div style={{ padding: "20px 0" }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
            {totalOnMap} active risk{totalOnMap !== 1 ? "s" : ""} plotted
            {view === "residual" && residualCount < activeRisks.length && (
              <span style={{ color: "#f59e0b", fontWeight: 400 }}> · {activeRisks.length - residualCount} without residual scores</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 6, padding: 2 }}>
          <button
            onClick={() => setView("inherent")}
            style={{
              padding: "5px 12px", fontSize: 12, fontWeight: view === "inherent" ? 600 : 400, borderRadius: 4,
              background: view === "inherent" ? "#fff" : "transparent",
              color: view === "inherent" ? "#111" : "#6b7280",
              border: "none", cursor: "pointer",
              boxShadow: view === "inherent" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            }}
          >
            Inherent
          </button>
          <button
            onClick={() => setView("residual")}
            style={{
              padding: "5px 12px", fontSize: 12, fontWeight: view === "residual" ? 600 : 400, borderRadius: 4,
              background: view === "residual" ? "#fff" : "transparent",
              color: view === "residual" ? "#111" : "#6b7280",
              border: "none", cursor: "pointer",
              boxShadow: view === "residual" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            }}
          >
            Residual
          </button>
        </div>
      </div>

      {/* 5×5 Grid */}
      <div style={{ display: "flex", gap: 0 }}>
        {/* Y-axis label */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, marginRight: 4 }}>
          <div style={{ transform: "rotate(-90deg)", whiteSpace: "nowrap", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Impact
          </div>
        </div>

        <div>
          <div style={{ display: "flex", gap: 0 }}>
            {/* Y-axis values */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginRight: 4 }}>
              {[5, 4, 3, 2, 1].map((impact) => (
                <div key={impact} style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563" }}>{impact}</div>
                    <div style={{ fontSize: 8, color: "#9ca3af", lineHeight: 1 }}>{IMPACT_LABELS[impact - 1]}</div>
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
                    const key = `${likelihood}-${impact}`;
                    const cellRisks = grid.get(key) || [];
                    const count = cellRisks.length;

                    return (
                      <div
                        key={likelihood}
                        title={count > 0 ? cellRisks.map((r) => r.title).join("\n") : `Score: ${score}`}
                        style={{
                          width: 72, height: 56,
                          background: cell.bg,
                          display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center",
                          border: "1px solid rgba(255,255,255,0.3)",
                          position: "relative",
                          opacity: count > 0 ? 1 : 0.4,
                          transition: "opacity 0.15s",
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 600, color: cell.text, opacity: count > 0 ? 0.4 : 0.6 }}>
                          {score}
                        </div>
                        {count > 0 && (
                          <div style={{
                            position: "absolute", top: 3, right: 3,
                            minWidth: 20, height: 20, borderRadius: 10,
                            background: "rgba(0,0,0,0.7)", color: "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, padding: "0 5px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          }}>
                            {count}
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
                  <div key={likelihood} style={{ width: 72, textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563" }}>{likelihood}</div>
                    <div style={{ fontSize: 8, color: "#9ca3af" }}>{LIKELIHOOD_LABELS[likelihood - 1]}</div>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: "center", marginTop: 6, fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Likelihood
              </div>
            </div>
          </div>

          {/* Distribution summary */}
          <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            {[
              { label: "Critical", min: 20, max: 25, color: "#ef4444" },
              { label: "High", min: 15, max: 19, color: "#f97316" },
              { label: "Medium", min: 10, max: 14, color: "#f59e0b" },
              { label: "Low", min: 5, max: 9, color: "#fbbf24" },
              { label: "Very Low", min: 1, max: 4, color: "#4ade80" },
            ].map((band) => {
              const bandCount = activeRisks.filter((r) => {
                let score: number;
                if (view === "inherent") {
                  score = r.inherent_score;
                } else {
                  if (!r.residual_likelihood || !r.residual_impact) return false;
                  score = r.residual_likelihood * r.residual_impact;
                }
                return score >= band.min && score <= band.max;
              }).length;

              return (
                <div key={band.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: band.color }} />
                  <span style={{ color: "#4b5563", fontWeight: 500 }}>
                    {band.label}: <strong>{bandCount}</strong>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Risk List ---
export default function RiskListClient({ risks }: { risks: Risk[] }) {
  const [activeTab, setActiveTab] = useState("ALL");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const filtered = activeTab === "ALL" ? risks : risks.filter((r) => r.status === activeTab);
  const pendingCount = risks.filter((r) => r.status === "PENDING_REVIEW").length;

  const handleApprove = (id: string) => {
    startTransition(async () => {
      await updateRisk(id, { status: "OPEN" });
      router.refresh();
    });
  };

  const handleReject = (id: string) => {
    startTransition(async () => {
      await updateRisk(id, { status: "REJECTED" });
      router.refresh();
    });
  };

  return (
    <>
      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "2px solid #f3f4f6",
        marginBottom: 16,
      }}>
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "ALL" ? risks.length
            : tab.key === "HEATMAP" ? null
            : risks.filter((r) => r.status === tab.key).length;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#111" : "#9ca3af",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid #111" : "2px solid transparent",
                marginBottom: -2,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tab.label}
              {count !== null && count > 0 && (
                <span style={{
                  fontSize: 11,
                  background: tab.key === "PENDING_REVIEW" && count > 0 ? "#f59e0b" : "#e5e7eb",
                  color: tab.key === "PENDING_REVIEW" && count > 0 ? "#fff" : "#6b7280",
                  padding: "1px 7px",
                  borderRadius: 10,
                  fontWeight: 600,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Heat Map Tab */}
      {activeTab === "HEATMAP" && (
        <div className="table-card" style={{ padding: "0 20px" }}>
          <HeatMapView risks={risks} />
        </div>
      )}

      {/* List View (all other tabs) */}
      {activeTab !== "HEATMAP" && (
        <>
          {/* Pending Review Banner */}
          {pendingCount > 0 && activeTab !== "PENDING_REVIEW" && (
            <div style={{
              background: "#fef3c7",
              border: "1px solid #f59e0b",
              borderRadius: 8,
              padding: "10px 16px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 13, color: "#92400e" }}>
                ⚠️ <strong>{pendingCount}</strong> risk{pendingCount > 1 ? "s" : ""} awaiting your review
              </span>
              <button
                onClick={() => setActiveTab("PENDING_REVIEW")}
                style={{ fontSize: 12, fontWeight: 600, color: "#92400e", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Review now →
              </button>
            </div>
          )}

          {/* Table */}
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Score</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th style={{ width: 160 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <a href={`/risks/${r.id}`} style={{ fontWeight: 550, color: "#111", textDecoration: "none" }}>
                        {r.title}
                      </a>
                    </td>
                    <td style={{ fontSize: 13 }}>{r.category || "—"}</td>
                    <td>
                      <span className={`score-badge ${scoreClass(r.inherent_score)}`}>
                        {r.inherent_score}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>
                      {riskLevel(r.inherent_score)}
                    </td>
                    <td>
                      <span className={`badge badge-${r.status.toLowerCase().replace(/_/g, "-")}`}>
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {r.due_date ? String(r.due_date).slice(0, 10) : "—"}
                    </td>
                    <td>
                      {r.status === "PENDING_REVIEW" ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: "4px 10px", fontSize: 11 }}
                            disabled={isPending}
                            onClick={() => handleApprove(r.id)}
                          >
                            ✓ Approve
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: "4px 10px", fontSize: 11 }}
                            disabled={isPending}
                            onClick={() => handleReject(r.id)}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      ) : (
                        <a href={`/risks/${r.id}`} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>
                          Open →
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "48px 24px" }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>No risks in this category</div>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>Try selecting a different tab, or create a new risk using the form above.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

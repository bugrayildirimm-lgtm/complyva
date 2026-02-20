"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Risk } from "../../../lib/types";
import { updateRisk } from "../../../lib/api";

const TABS = [
  { key: "PENDING_REVIEW", label: "⏳ Pending Review" },
  { key: "OPEN", label: "Open" },
  { key: "IN_TREATMENT", label: "In Treatment" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "CLOSED", label: "Closed" },
  { key: "ALL", label: "All" },
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
        {TABS.map((tab) => {
          const count = tab.key === "ALL" ? risks.length : risks.filter((r) => r.status === tab.key).length;
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
              {count > 0 && (
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
                <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 32 }}>
                  No risks in this category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

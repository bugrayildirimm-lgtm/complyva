"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Change } from "../../../lib/types";
import { updateChange } from "../../../lib/api";

const PRIO_COLORS: Record<string, string> = { CRITICAL: "#ef4444", HIGH: "#f59e0b", MEDIUM: "#3b82f6", LOW: "#22c55e" };
const CLASS_COLORS: Record<number, string> = { 1: "#22c55e", 2: "#3b82f6", 3: "#f59e0b", 4: "#ef4444" };
const CLASS_LABELS: Record<number, string> = { 1: "Supporting", 2: "Significant", 3: "Critical", 4: "Highly Critical" };

export default function ApprovalsClient({
  pending,
  recentlyReviewed,
  totalChanges,
}: {
  pending: Change[];
  recentlyReviewed: Change[];
  totalChanges: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApprove = (id: string) => {
    startTransition(async () => {
      await updateChange(id, { status: "APPROVED" });
      router.refresh();
    });
  };

  const handleReject = (id: string) => {
    startTransition(async () => {
      await updateChange(id, { status: "REJECTED" });
      router.refresh();
    });
  };

  const handleRequestInfo = (id: string) => {
    startTransition(async () => {
      await updateChange(id, { status: "DRAFT" });
      router.refresh();
    });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Change Approvals</h1>
          <p className="page-subtitle">Review and approve change requests before implementation</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: "16px 20px", textAlign: "center", borderLeft: "3px solid #f59e0b" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: pending.length > 0 ? "#f59e0b" : "#22c55e" }}>
            {pending.length}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>
            Awaiting Review
          </div>
        </div>
        <div className="card" style={{ padding: "16px 20px", textAlign: "center", borderLeft: "3px solid #22c55e" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#22c55e" }}>
            {recentlyReviewed.filter((c) => c.status === "APPROVED").length}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>
            Recently Approved
          </div>
        </div>
        <div className="card" style={{ padding: "16px 20px", textAlign: "center", borderLeft: "3px solid #ef4444" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#ef4444" }}>
            {recentlyReviewed.filter((c) => c.status === "REJECTED").length}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>
            Recently Rejected
          </div>
        </div>
      </div>

      {/* Pending Queue */}
      {pending.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>All caught up!</div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>No change requests pending your review.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {pending.map((c) => (
            <div key={c.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Header Row */}
              <div style={{
                padding: "16px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: expanded[c.id] ? "1px solid #f3f4f6" : "none",
                cursor: "pointer",
              }}
                onClick={() => toggleExpand(c.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: 4,
                      fontSize: 10, fontWeight: 700, color: "#fff", background: PRIO_COLORS[c.priority],
                    }}>{c.priority}</span>
                    <span className={`badge badge-${c.change_type.toLowerCase()}`} style={{ fontSize: 10 }}>{c.change_type}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{c.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, display: "flex", gap: 16 }}>
                    <span>Requested by: <strong style={{ color: "#6b7280" }}>{c.requested_by || "Unknown"}</strong></span>
                    {c.asset_name && (
                      <span>
                        Asset: <strong style={{ color: "#6b7280" }}>{c.asset_name}</strong>
                        {c.asset_classification && (
                          <span style={{
                            marginLeft: 4, fontSize: 10, fontWeight: 700, color: "#fff",
                            padding: "1px 5px", borderRadius: 3, background: CLASS_COLORS[c.asset_classification],
                          }}>L{c.asset_classification}</span>
                        )}
                      </span>
                    )}
                    {c.planned_start && <span>Planned: {String(c.planned_start).slice(0, 10)}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 12 }}
                    disabled={isPending} onClick={(e) => { e.stopPropagation(); handleApprove(c.id); }}>
                    ✓ Approve
                  </button>
                  <button className="btn btn-danger" style={{ padding: "6px 14px", fontSize: 12 }}
                    disabled={isPending} onClick={(e) => { e.stopPropagation(); handleReject(c.id); }}>
                    ✕ Reject
                  </button>
                  <button className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: 12 }}
                    disabled={isPending} onClick={(e) => { e.stopPropagation(); handleRequestInfo(c.id); }}>
                    ↩ Return
                  </button>
                  <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 4 }}>
                    {expanded[c.id] ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Expanded Details */}
              {expanded[c.id] && (
                <div style={{ padding: "16px 20px", background: "#fafafa" }}>
                  {/* High classification warning */}
                  {c.asset_classification && c.asset_classification >= 3 && (
                    <div style={{
                      background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6,
                      padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#991b1b",
                    }}>
                      🔒 This change affects a <strong>Level {c.asset_classification} ({CLASS_LABELS[c.asset_classification]})</strong> asset. Elevated approval required.
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>Description</div>
                      <div style={{ fontSize: 13, color: "#374151" }}>{c.description || "No description provided."}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>Justification</div>
                      <div style={{ fontSize: 13, color: "#374151" }}>{c.justification || "No justification provided."}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>Impact Analysis</div>
                      <div style={{ fontSize: 13, color: "#374151" }}>{c.impact_analysis || "Not provided."}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>Rollback Plan</div>
                      <div style={{ fontSize: 13, color: "#374151" }}>{c.rollback_plan || "Not provided."}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, textAlign: "right" }}>
                    <a href={`/changes/${c.id}`} style={{ fontSize: 12, color: "#2563eb", textDecoration: "none" }}>
                      View full details →
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recently Reviewed */}
      {recentlyReviewed.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 12 }}>Recently Reviewed</div>
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Decision</th>
                  <th>Asset</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentlyReviewed.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 550, color: "#111" }}>{c.title}</td>
                    <td><span className={`badge badge-${c.change_type.toLowerCase()}`}>{c.change_type}</span></td>
                    <td>
                      <span style={{
                        display: "inline-block", padding: "2px 10px", borderRadius: 4,
                        fontSize: 11, fontWeight: 700, color: "#fff",
                        background: c.status === "APPROVED" ? "#22c55e" : "#ef4444",
                      }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{c.asset_name || "—"}</td>
                    <td>
                      <a href={`/changes/${c.id}`} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>Open →</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import type { Change } from "../../../lib/types";

const TABS = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "COMPLETED", label: "Completed" },
];

const PRIO_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f59e0b", MEDIUM: "#3b82f6", LOW: "#22c55e",
};

const CLASS_COLORS: Record<number, string> = { 1: "#22c55e", 2: "#3b82f6", 3: "#f59e0b", 4: "#ef4444" };

export default function ChangeListClient({ changes }: { changes: Change[] }) {
  const [activeTab, setActiveTab] = useState("ALL");

  const filtered = (() => {
    if (activeTab === "ALL") return changes;
    if (activeTab === "ACTIVE") return changes.filter((c) => ["APPROVED", "IN_PROGRESS"].includes(c.status));
    if (activeTab === "COMPLETED") return changes.filter((c) => ["COMPLETED", "ROLLED_BACK", "CANCELLED", "REJECTED"].includes(c.status));
    return changes;
  })();

  return (
    <>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #f3f4f6", marginBottom: 16 }}>
        {TABS.map((tab) => {
          const count = (() => {
            if (tab.key === "ALL") return changes.length;
            if (tab.key === "ACTIVE") return changes.filter((c) => ["APPROVED", "IN_PROGRESS"].includes(c.status)).length;
            if (tab.key === "COMPLETED") return changes.filter((c) => ["COMPLETED", "ROLLED_BACK", "CANCELLED", "REJECTED"].includes(c.status)).length;
            return 0;
          })();
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "10px 18px", fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? "#111" : "#9ca3af", background: "none", border: "none",
                borderBottom: isActive ? "2px solid #111" : "2px solid transparent",
                marginBottom: -2, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {tab.label}
              {count > 0 && (
                <span style={{
                  fontSize: 11, padding: "1px 7px", borderRadius: 10, fontWeight: 600,
                  background: tab.key === "PENDING" && count > 0 ? "#f59e0b" : "#e5e7eb",
                  color: tab.key === "PENDING" && count > 0 ? "#fff" : "#6b7280",
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Affected Asset</th>
              <th>Status</th>
              <th>Planned Date</th>
              <th style={{ width: 160 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <a href={`/changes/${c.id}`} style={{ fontWeight: 550, color: "#111", textDecoration: "none" }}>
                    {c.title}
                  </a>
                </td>
                <td><span className={`badge badge-${c.change_type.toLowerCase()}`}>{c.change_type}</span></td>
                <td>
                  <span style={{
                    display: "inline-block", padding: "2px 10px", borderRadius: 4,
                    fontSize: 11, fontWeight: 700, color: "#fff", background: PRIO_COLORS[c.priority],
                  }}>{c.priority}</span>
                </td>
                <td style={{ fontSize: 13 }}>
                  {c.asset_name ? (
                    <div>
                      <a href={`/assets/${c.asset_id}`} style={{ color: "#2563eb", textDecoration: "none", fontSize: 12 }}>{c.asset_name}</a>
                      {c.asset_classification && (
                        <span style={{
                          marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#fff", padding: "1px 6px",
                          borderRadius: 3, background: CLASS_COLORS[c.asset_classification],
                        }}>L{c.asset_classification}</span>
                      )}
                    </div>
                  ) : "—"}
                </td>
                <td><span className={`badge badge-${c.status.toLowerCase().replace(/_/g, "-")}`}>{c.status.replace(/_/g, " ")}</span></td>
                <td style={{ fontSize: 13 }}>{c.planned_start ? String(c.planned_start).slice(0, 10) : "—"}</td>
                <td>
                    <a href={`/changes/${c.id}`} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>Open →</a>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 32 }}>No changes in this category.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

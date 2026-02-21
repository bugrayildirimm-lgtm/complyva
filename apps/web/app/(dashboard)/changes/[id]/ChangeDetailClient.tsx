"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, InlineEdit, DeleteButton, StatusDropdown } from "../../ActionComponents";
import EvidencePanel from "../../EvidencePanel";
import type { Change } from "../../../../lib/types";

const PRIO_COLORS: Record<string, string> = { CRITICAL: "#ef4444", HIGH: "#f59e0b", MEDIUM: "#3b82f6", LOW: "#22c55e" };
const CLASS_COLORS: Record<number, string> = { 1: "#22c55e", 2: "#3b82f6", 3: "#f59e0b", 4: "#ef4444" };
const CLASS_LABELS: Record<number, string> = { 1: "Supporting", 2: "Significant", 3: "Critical", 4: "Highly Critical" };

export default function ChangeDetailClient({
  change,
  assets,
  evidence,
  activity,
  updateChange,
  deleteChange,
  uploadEvidence,
  deleteEvidence,
  role,
}: {
  change: Change;
  assets: any[];
  evidence: any[];
  activity: any[];
  updateChange: (id: string, data: Record<string, any>) => Promise<void>;
  deleteChange: (id: string) => Promise<void>;
  uploadEvidence: (entityType: string, entityId: string, formData: FormData) => Promise<any>;
  deleteEvidence: (fileId: string) => Promise<any>;
  role: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const canEdit = role !== "VIEWER";

  const handleSaveField = async (name: string, value: string) => {
    await updateChange(change.id, { [name]: value });
    router.refresh();
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateChange(change.id, { status: newStatus });
    router.refresh();
  };

  const handleDelete = async () => {
    await deleteChange(change.id);
    router.push("/changes");
  };

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <a href="/changes" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>← Back to Change Management</a>
          <h1 className="page-title" style={{ marginTop: 4 }}>{change.title}</h1>
          <p className="page-subtitle">
            {change.change_type} · Requested by {change.requested_by || "Unknown"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusDropdown
            currentStatus={change.status}
            options={["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED", "ROLLED_BACK", "CANCELLED"]}
            onStatusChange={handleStatusChange}
          />
          {canEdit && <DeleteButton onDelete={handleDelete} />}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Type</div>
          <span className={`badge badge-${change.change_type.toLowerCase()}`} style={{ fontSize: 13 }}>{change.change_type}</span>
        </div>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center", borderTop: `3px solid ${PRIO_COLORS[change.priority]}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Priority</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: PRIO_COLORS[change.priority] }}>{change.priority}</span>
        </div>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Affected Asset</div>
          {change.asset_name ? (
            <div>
              <a href={`/assets/${change.asset_id}`} style={{ color: "#2563eb", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>{change.asset_name}</a>
              {change.asset_classification && (
                <div style={{ fontSize: 11, color: CLASS_COLORS[change.asset_classification], fontWeight: 600, marginTop: 2 }}>
                  Level {change.asset_classification} — {CLASS_LABELS[change.asset_classification]}
                </div>
              )}
            </div>
          ) : <span style={{ fontSize: 13, color: "#9ca3af" }}>None</span>}
        </div>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Planned Window</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
            {change.planned_start ? String(change.planned_start).slice(0, 10) : "—"}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            to {change.planned_end ? String(change.planned_end).slice(0, 10) : "—"}
          </div>
        </div>
      </div>

      {/* Approval Required Banner */}
      {change.asset_classification && change.asset_classification >= 3 && ["DRAFT", "SUBMITTED"].includes(change.status) && (
        <div style={{
          background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 8,
          padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#991b1b",
        }}>
          🔒 This change affects a <strong>Level {change.asset_classification}</strong> asset. Senior management approval is required before implementation.
        </div>
      )}

      {/* Tabs */}
      <div className="card">
        <Tabs tabs={["Details", "Planning", "Evidence", "Activity"]}>
          {/* Details Tab */}
          <div>
            <InlineEdit label="Title" name="title" value={change.title} onSave={handleSaveField} />
            <InlineEdit label="Description" name="description" value={change.description || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="Change Type" name="changeType" value={change.change_type} type="select"
              options={["STANDARD", "NORMAL", "EMERGENCY", "EXPEDITED"]} onSave={handleSaveField} />
            <InlineEdit label="Priority" name="priority" value={change.priority} type="select"
              options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]} onSave={handleSaveField} />
            <InlineEdit label="Requested By" name="requestedBy" value={change.requested_by || ""} onSave={handleSaveField} />
            <InlineEdit label="Approved By" name="approvedBy" value={change.approved_by || ""} onSave={handleSaveField} />
            <InlineEdit label="Implemented By" name="implementedBy" value={change.implemented_by || ""} onSave={handleSaveField} />
          </div>

          {/* Planning Tab */}
          <div>
            <InlineEdit label="Justification" name="justification" value={change.justification || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="Impact Analysis" name="impactAnalysis" value={change.impact_analysis || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="Rollback Plan" name="rollbackPlan" value={change.rollback_plan || ""} type="textarea" onSave={handleSaveField} />

            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 20, marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 12 }}>Schedule</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InlineEdit label="Planned Start" name="plannedStart" value={change.planned_start ? String(change.planned_start).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
                <InlineEdit label="Planned End" name="plannedEnd" value={change.planned_end ? String(change.planned_end).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
                <InlineEdit label="Actual Start" name="actualStart" value={change.actual_start ? String(change.actual_start).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
                <InlineEdit label="Actual End" name="actualEnd" value={change.actual_end ? String(change.actual_end).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
              </div>
            </div>
          </div>

          {/* Evidence Tab */}
          <div>
            <EvidencePanel
              entityType="CHANGE"
              entityId={change.id}
              files={evidence}
              uploadAction={uploadEvidence}
              deleteAction={deleteEvidence}
              readOnly={!canEdit}
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

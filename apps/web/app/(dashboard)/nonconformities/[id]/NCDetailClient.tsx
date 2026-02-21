"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, InlineEdit, DeleteButton, StatusDropdown, ConfirmAction } from "../../ActionComponents";
import EvidencePanel from "../../EvidencePanel";
import LinkedItemsPanel from "../../LinkedItemsPanel";
import { useToast } from "../../Toast";
import type { NonConformity } from "../../../../lib/types";

const SEV_COLORS: Record<string, string> = { CRITICAL: "#ef4444", MAJOR: "#f59e0b", MINOR: "#3b82f6", OBSERVATION: "#22c55e" };

const STATUS_FLOW = [
  { status: "OPEN", label: "Raised", color: "#ef4444" },
  { status: "UNDER_INVESTIGATION", label: "Investigating", color: "#f59e0b" },
  { status: "CONTAINMENT", label: "Contained", color: "#3b82f6" },
  { status: "CORRECTIVE_ACTION", label: "Corrective Action", color: "#8b5cf6" },
  { status: "VERIFIED", label: "Verified", color: "#22c55e" },
  { status: "CLOSED", label: "Closed", color: "#6b7280" },
];

export default function NCDetailClient({
  nc,
  assets,
  evidence,
  activity,
  crossLinks,
  updateNC,
  deleteNC,
  sendNCToCAPA,
  uploadEvidence,
  deleteEvidence,
  role,
}: {
  nc: NonConformity;
  assets: any[];
  evidence: any[];
  activity: any[];
  crossLinks: any[];
  updateNC: (id: string, data: Record<string, any>) => Promise<void>;
  deleteNC: (id: string) => Promise<void>;
  sendNCToCAPA: (id: string) => Promise<any>;
  uploadEvidence: (entityType: string, entityId: string, formData: FormData) => Promise<any>;
  deleteEvidence: (fileId: string) => Promise<any>;
  role: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const canEdit = role !== "VIEWER";

  const handleSaveField = async (name: string, value: string) => {
    await updateNC(nc.id, { [name]: value });
    router.refresh();
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateNC(nc.id, { status: newStatus });
    router.refresh();
  };

  const handleDelete = async () => {
    await deleteNC(nc.id);
    router.push("/nonconformities");
  };

  const handleSendToCAPA = async () => {
    await sendNCToCAPA(nc.id);
    router.refresh();
    toast.success("CAPA created from this non-conformity — it will appear in the CAPA Log.");
  };

  const currentStepIndex = STATUS_FLOW.findIndex((s) => s.status === nc.status);
  const isOverdue = nc.due_date && nc.status !== "CLOSED" && new Date(nc.due_date) < new Date();
  const daysUntilDue = nc.due_date ? Math.ceil((new Date(nc.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <a href="/nonconformities" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>← Back to NC Register</a>
          <h1 className="page-title" style={{ marginTop: 4 }}>{nc.title}</h1>
          <p className="page-subtitle">
            {nc.source_type.replace(/_/g, " ")} · {nc.category || "Uncategorized"} · Raised by {nc.raised_by || "Unknown"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canEdit && <ConfirmAction
            trigger={
              <button disabled={isPending}
                style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "1px solid #3b82f6", background: "#eff6ff", color: "#3b82f6", cursor: "pointer" }}>
                → CAPA
              </button>
            }
            message="Create a CAPA from this non-conformity? It will appear in the CAPA Log."
            confirmLabel="Create CAPA"
            confirmStyle="primary"
            onConfirm={handleSendToCAPA}
          />}
          <StatusDropdown
            currentStatus={nc.status}
            options={["OPEN", "UNDER_INVESTIGATION", "CONTAINMENT", "CORRECTIVE_ACTION", "VERIFIED", "CLOSED"]}
            onStatusChange={handleStatusChange}
          />
          {canEdit && <DeleteButton onDelete={handleDelete} />}
        </div>
      </div>

      {/* Overdue Banner */}
      {isOverdue && (
        <div style={{
          background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 8,
          padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#991b1b",
        }}>
          🚨 This NC is <strong>{Math.abs(daysUntilDue!)} days overdue</strong>. Due date was {String(nc.due_date).slice(0, 10)}.
        </div>
      )}

      {/* Progress Flow */}
      <div className="card" style={{ padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 12 }}>
          Resolution Progress
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {STATUS_FLOW.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={step.status} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", margin: "0 auto 4px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#fff",
                    background: isCompleted ? "#22c55e" : isCurrent ? step.color : "#e5e7eb",
                  }}>
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <div style={{ fontSize: 10, color: isCurrent ? step.color : "#9ca3af", fontWeight: isCurrent ? 700 : 400 }}>
                    {step.label}
                  </div>
                </div>
                {idx < STATUS_FLOW.length - 1 && (
                  <div style={{ height: 2, flex: "0 0 20px", background: isCompleted ? "#22c55e" : "#e5e7eb" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center", borderTop: `3px solid ${SEV_COLORS[nc.severity]}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Severity</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: SEV_COLORS[nc.severity] }}>{nc.severity}</span>
        </div>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Source</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{nc.source_type.replace(/_/g, " ")}</div>
        </div>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Due Date</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: isOverdue ? "#ef4444" : "#111" }}>
            {nc.due_date ? String(nc.due_date).slice(0, 10) : "—"}
            {daysUntilDue !== null && nc.status !== "CLOSED" && (
              <div style={{ fontSize: 11, color: isOverdue ? "#ef4444" : "#9ca3af", marginTop: 2 }}>
                {isOverdue ? `${Math.abs(daysUntilDue)} days overdue` : `${daysUntilDue} days remaining`}
              </div>
            )}
          </div>
        </div>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Linked Asset</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {nc.asset_name ? (
              <a href={`/assets/${nc.asset_id}`} style={{ color: "#2563eb", textDecoration: "none" }}>{nc.asset_name}</a>
            ) : "None"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <Tabs tabs={["Details", "Investigation", "Evidence", "Linked Items", "Activity"]}>
          {/* Details Tab */}
          <div>
            <InlineEdit label="Title" name="title" value={nc.title} onSave={handleSaveField} required />
            <InlineEdit label="Description" name="description" value={nc.description || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="Severity" name="severity" value={nc.severity} type="select"
              options={["OBSERVATION", "MINOR", "MAJOR", "CRITICAL"]} onSave={handleSaveField} />
            <InlineEdit label="Source Type" name="sourceType" value={nc.source_type} type="select"
              options={["AUDIT", "INCIDENT", "CUSTOMER_COMPLAINT", "INTERNAL", "REGULATORY", "SUPPLIER"]} onSave={handleSaveField} />
            <InlineEdit label="Category" name="category" value={nc.category || ""} onSave={handleSaveField} />
            <InlineEdit label="Raised By" name="raisedBy" value={nc.raised_by || ""} onSave={handleSaveField} />
            <InlineEdit label="Assigned To" name="assignedTo" value={nc.assigned_to || ""} onSave={handleSaveField} />
            <InlineEdit label="Due Date" name="dueDate" value={nc.due_date ? String(nc.due_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
            <InlineEdit label="Closed Date" name="closedDate" value={nc.closed_date ? String(nc.closed_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
          </div>

          {/* Investigation Tab */}
          <div>
            <InlineEdit label="Root Cause" name="rootCause" value={nc.root_cause || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="Containment Action" name="containmentAction" value={nc.containment_action || ""} type="textarea" onSave={handleSaveField} />
          </div>

          {/* Evidence Tab */}
          <div>
            <EvidencePanel
              entityType="NC"
              entityId={nc.id}
              files={evidence}
              uploadAction={uploadEvidence}
              deleteAction={deleteEvidence}
              readOnly={!canEdit}
            />
          </div>

          {/* Linked Items Tab */}
          <div>
            <LinkedItemsPanel entityType="NC" entityId={nc.id} links={crossLinks} />
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

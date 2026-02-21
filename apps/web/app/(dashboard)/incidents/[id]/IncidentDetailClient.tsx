"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, InlineEdit, DeleteButton, StatusDropdown, ConfirmAction } from "../../ActionComponents";
import LinkedItemsPanel from "../../LinkedItemsPanel";
import EvidencePanel from "../../EvidencePanel";
import { useToast } from "../../Toast";
import type { Incident, Asset } from "../../../../lib/types";

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f59e0b", MEDIUM: "#3b82f6", LOW: "#22c55e",
};

export default function IncidentDetailClient({
  incident,
  assets,
  evidence,
  activity,
  crossLinks,
  updateIncident,
  deleteIncident,
  sendIncidentToRisk,
  sendIncidentToNC,
  uploadEvidence,
  deleteEvidence,
  role,
}: {
  incident: Incident;
  assets: Asset[];
  evidence: any[];
  activity: any[];
  crossLinks: any[];
  updateIncident: (id: string, data: Record<string, any>) => Promise<void>;
  deleteIncident: (id: string) => Promise<void>;
  sendIncidentToRisk: (id: string) => Promise<any>;
  sendIncidentToNC: (id: string) => Promise<any>;
  uploadEvidence: (entityType: string, entityId: string, formData: FormData) => Promise<any>;
  deleteEvidence: (fileId: string) => Promise<any>;
  role: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const canEdit = role !== "VIEWER";

  const handleSaveField = async (name: string, value: string) => {
    await updateIncident(incident.id, { [name]: value });
    router.refresh();
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateIncident(incident.id, { status: newStatus });
    router.refresh();
  };

  const handleDelete = async () => {
    await deleteIncident(incident.id);
    router.push("/incidents");
  };

  const handleSendToRisk = async () => {
    await sendIncidentToRisk(incident.id);
    router.refresh();
    toast.success("Risk created from incident — it will appear as PENDING REVIEW in the Risk Register.");
  };

  const handleSendToNC = async () => {
    await sendIncidentToNC(incident.id);
    router.refresh();
    toast.success("Non-conformity created from incident — it will appear in the NC Register.");
  };

  const detectionDelay = incident.incident_date && incident.detected_date
    ? Math.ceil((new Date(incident.detected_date).getTime() - new Date(incident.incident_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <a href="/incidents" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>← Back to Incident Log</a>
          <h1 className="page-title" style={{ marginTop: 4 }}>{incident.title}</h1>
          <p className="page-subtitle">
            {incident.category || "Uncategorized"} · Reported by {incident.reported_by || "Unknown"}
          </p>
        </div>
        {canEdit && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ConfirmAction
            trigger={
              <button disabled={isPending}
                style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "1px solid #ef4444", background: "#fef2f2", color: "#ef4444", cursor: "pointer" }}>
                → Risk
              </button>
            }
            message="Create a new risk from this incident? It will appear in the Risk Register as PENDING REVIEW."
            confirmLabel="Create Risk"
            confirmStyle="primary"
            onConfirm={handleSendToRisk}
          />
          <ConfirmAction
            trigger={
              <button disabled={isPending}
                style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "1px solid #8b5cf6", background: "#f5f3ff", color: "#8b5cf6", cursor: "pointer" }}>
                → NC
              </button>
            }
            message="Create a non-conformity from this incident? It will appear in the NC Register."
            confirmLabel="Create NC"
            confirmStyle="primary"
            onConfirm={handleSendToNC}
          />
          <StatusDropdown
            currentStatus={incident.status}
            options={["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"]}
            onStatusChange={handleStatusChange}
          />
          {canEdit && <DeleteButton onDelete={handleDelete} />}
        </div>}
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center", borderTop: `3px solid ${SEV_COLORS[incident.severity]}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Severity</div>
          <span style={{
            display: "inline-block", padding: "2px 12px", borderRadius: 4,
            fontSize: 13, fontWeight: 700, color: "#fff",
            background: SEV_COLORS[incident.severity],
          }}>{incident.severity}</span>
        </div>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Incident Date</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>
            {incident.incident_date ? String(incident.incident_date).slice(0, 10) : "—"}
          </div>
        </div>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Detection Delay</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: detectionDelay !== null && detectionDelay > 7 ? "#ef4444" : "#111" }}>
            {detectionDelay !== null ? `${detectionDelay} day${detectionDelay !== 1 ? "s" : ""}` : "—"}
          </div>
        </div>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Linked Asset</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {incident.asset_name ? (
              <a href={`/assets/${incident.asset_id}`} style={{ color: "#2563eb", textDecoration: "none" }}>{incident.asset_name}</a>
            ) : "None"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <Tabs tabs={["Details", "Investigation", "Evidence", "Linked Items", "Activity"]}>
          {/* Details Tab */}
          <div>
            <InlineEdit label="Title" name="title" value={incident.title} onSave={handleSaveField} required />
            <InlineEdit label="Description" name="description" value={incident.description || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="Category" name="category" value={incident.category || ""} onSave={handleSaveField} />
            <InlineEdit label="Severity" name="severity" value={incident.severity} type="select"
              options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]} onSave={handleSaveField} />
            <InlineEdit label="Incident Date" name="incidentDate" value={incident.incident_date ? String(incident.incident_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
            <InlineEdit label="Detected Date" name="detectedDate" value={incident.detected_date ? String(incident.detected_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
            <InlineEdit label="Reported By" name="reportedBy" value={incident.reported_by || ""} onSave={handleSaveField} />
            <InlineEdit label="Assigned To" name="assignedTo" value={incident.assigned_to || ""} onSave={handleSaveField} />
          </div>

          {/* Investigation Tab */}
          <div>
            <InlineEdit label="Root Cause" name="rootCause" value={incident.root_cause || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="Immediate Action Taken" name="immediateAction" value={incident.immediate_action || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="Corrective Action" name="correctiveAction" value={incident.corrective_action || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="Resolved Date" name="resolvedDate" value={incident.resolved_date ? String(incident.resolved_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />

            {/* Timeline */}
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 20, marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 12 }}>Incident Timeline</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 20, borderLeft: "2px solid #e5e7eb" }}>
                {incident.incident_date && (
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: -26, top: 4, width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{String(incident.incident_date).slice(0, 10)}</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Incident Occurred</div>
                  </div>
                )}
                {incident.detected_date && (
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: -26, top: 4, width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{String(incident.detected_date).slice(0, 10)}</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Detected</div>
                  </div>
                )}
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: -26, top: 4, width: 10, height: 10, borderRadius: "50%", background: "#3b82f6" }} />
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{String(incident.created_at).slice(0, 10)}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Reported in Complyva</div>
                </div>
                {incident.resolved_date && (
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: -26, top: 4, width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{String(incident.resolved_date).slice(0, 10)}</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Resolved</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Evidence Tab */}
          <div>
            <EvidencePanel
              entityType="INCIDENT"
              entityId={incident.id}
              files={evidence}
              uploadAction={uploadEvidence}
              deleteAction={deleteEvidence}
              readOnly={!canEdit}
            />
          </div>

          {/* Linked Items Tab */}
          <div>
            <LinkedItemsPanel entityType="INCIDENT" entityId={incident.id} links={crossLinks} />
          </div>

          {/* Activity Tab */}
          <div>
            {activity.map((a: any) => (
              <div key={a.id} style={{
                padding: "10px 0",
                borderBottom: "1px solid #f3f4f6",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
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

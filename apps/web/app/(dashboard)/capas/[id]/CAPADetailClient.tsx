"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, InlineEdit, DeleteButton, StatusDropdown } from "../../ActionComponents";
import EvidencePanel from "../../EvidencePanel";
import type { CAPA } from "../../../../lib/types";

const PRIO_COLORS: Record<string, string> = { CRITICAL: "#ef4444", HIGH: "#f59e0b", MEDIUM: "#3b82f6", LOW: "#22c55e" };
const TYPE_COLORS: Record<string, string> = { CORRECTIVE: "#ef4444", PREVENTIVE: "#3b82f6", CORRECTION: "#f59e0b" };
const EFF_COLORS: Record<string, string> = { EFFECTIVE: "#22c55e", PARTIALLY_EFFECTIVE: "#f59e0b", NOT_EFFECTIVE: "#ef4444" };

const ANALYSIS_LABELS: Record<string, string> = {
  FIVE_WHYS: "5 Whys", FISHBONE: "Fishbone (Ishikawa)", FAULT_TREE: "Fault Tree Analysis", TREND_ANALYSIS: "Trend Analysis",
};

const STATUS_FLOW = [
  { status: "OPEN", label: "Open", color: "#ef4444" },
  { status: "UNDER_INVESTIGATION", label: "Investigating", color: "#f59e0b" },
  { status: "ACTION_DEFINED", label: "Action Defined", color: "#8b5cf6" },
  { status: "IN_PROGRESS", label: "In Progress", color: "#3b82f6" },
  { status: "PENDING_VERIFICATION", label: "Verification", color: "#0ea5e9" },
  { status: "CLOSED", label: "Closed", color: "#6b7280" },
];

function capaId(year: string, num: number) {
  return `CAPA-${year}-${String(num).padStart(3, "0")}`;
}

export default function CAPADetailClient({
  capa,
  assets,
  evidence,
  activity,
  updateCAPA,
  deleteCAPA,
  uploadEvidence,
  deleteEvidence,
}: {
  capa: CAPA;
  assets: any[];
  evidence: any[];
  activity: any[];
  updateCAPA: (id: string, data: Record<string, any>) => Promise<void>;
  deleteCAPA: (id: string) => Promise<void>;
  uploadEvidence: (entityType: string, entityId: string, formData: FormData) => Promise<any>;
  deleteEvidence: (fileId: string) => Promise<any>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSaveField = async (name: string, value: string) => {
    await updateCAPA(capa.id, { [name]: value });
    router.refresh();
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateCAPA(capa.id, { status: newStatus });
    router.refresh();
  };

  const handleDelete = async () => {
    await deleteCAPA(capa.id);
    router.push("/capas");
  };

  const openStatuses = ["OPEN", "UNDER_INVESTIGATION", "ACTION_DEFINED", "IN_PROGRESS", "PENDING_VERIFICATION", "REOPENED"];
  const currentStepIndex = STATUS_FLOW.findIndex((s) => s.status === capa.status);
  const isOverdue = capa.due_date && openStatuses.includes(capa.status) && new Date(capa.due_date) < new Date();
  const daysUntilDue = capa.due_date ? Math.ceil((new Date(capa.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const year = String(capa.created_at).slice(0, 4);

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <a href="/capas" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>← Back to CAPA Log</a>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 600, color: "#9ca3af", background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>
              {capaId(year, capa.capa_number)}
            </span>
            <h1 className="page-title" style={{ margin: 0 }}>{capa.title}</h1>
          </div>
          <p className="page-subtitle">
            {capa.capa_type} Action · Assigned to {capa.assigned_to || "Unassigned"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusDropdown
            currentStatus={capa.status}
            options={["OPEN", "UNDER_INVESTIGATION", "ACTION_DEFINED", "IN_PROGRESS", "PENDING_VERIFICATION", "CLOSED", "REOPENED"]}
            onStatusChange={handleStatusChange}
          />
          <DeleteButton onDelete={handleDelete} />
        </div>
      </div>

      {/* Banners */}
      {isOverdue && (
        <div style={{ background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#991b1b" }}>
          🚨 This CAPA is <strong>{Math.abs(daysUntilDue!)} days overdue</strong>. Due date was {String(capa.due_date).slice(0, 10)}.
        </div>
      )}
      {capa.status === "REOPENED" && (
        <div style={{ background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#991b1b" }}>
          ⚠️ This CAPA has been <strong>reopened</strong>. Previous actions were insufficient — further investigation required.
        </div>
      )}
      {capa.effectiveness_status === "NOT_EFFECTIVE" && (
        <div style={{ background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#991b1b" }}>
          ⚠️ Effectiveness verification result: <strong>Not Effective</strong>. Consider reopening or creating a new CAPA.
        </div>
      )}
      {capa.effectiveness_status === "PARTIALLY_EFFECTIVE" && (
        <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#92400e" }}>
          ⚠️ Effectiveness verification result: <strong>Partially Effective</strong>. Additional actions may be needed.
        </div>
      )}

      {/* Progress Flow */}
      <div className="card" style={{ padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 12 }}>
          CAPA Lifecycle
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
        <div className="card" style={{ padding: "14px 16px", textAlign: "center", borderTop: `3px solid ${TYPE_COLORS[capa.capa_type]}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Type</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: TYPE_COLORS[capa.capa_type] }}>{capa.capa_type}</span>
        </div>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center", borderTop: `3px solid ${PRIO_COLORS[capa.priority]}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Priority</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: PRIO_COLORS[capa.priority] }}>{capa.priority}</span>
        </div>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Due Date</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: isOverdue ? "#ef4444" : "#111" }}>
            {capa.due_date ? String(capa.due_date).slice(0, 10) : "—"}
          </div>
        </div>
        <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 4 }}>Effectiveness</div>
          {capa.effectiveness_status ? (
            <span style={{ fontSize: 12, fontWeight: 700, color: EFF_COLORS[capa.effectiveness_status] }}>
              {capa.effectiveness_status.replace(/_/g, " ")}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#9ca3af" }}>Pending</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <Tabs tabs={["Details", "Investigation", "Action & Verification", "Closure", "Evidence", "Activity"]}>
          {/* Details Tab */}
          <div>
            <InlineEdit label="Title" name="title" value={capa.title} onSave={handleSaveField} />
            <InlineEdit label="Description / Background" name="description" value={capa.description || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="CAPA Type" name="capaType" value={capa.capa_type} type="select"
              options={["CORRECTIVE", "PREVENTIVE", "CORRECTION"]} onSave={handleSaveField} />
            <InlineEdit label="Priority" name="priority" value={capa.priority} type="select"
              options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]} onSave={handleSaveField} />
            <InlineEdit label="Source" name="sourceType" value={capa.source_type || ""} type="select"
              options={["INTERNAL_AUDIT", "EXTERNAL_AUDIT", "INCIDENT", "COMPLAINT", "MONITORING", "RISK_ASSESSMENT", "REGULATORY"]} onSave={handleSaveField} />
            <InlineEdit label="Raised By" name="raisedBy" value={capa.raised_by || ""} onSave={handleSaveField} />
            <InlineEdit label="Assigned To" name="assignedTo" value={capa.assigned_to || ""} onSave={handleSaveField} />
            <InlineEdit label="Due Date" name="dueDate" value={capa.due_date ? String(capa.due_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
            <InlineEdit label="Linked Asset" name="assetId" value={capa.asset_id || ""} onSave={handleSaveField} />
          </div>

          {/* Investigation Tab */}
          <div>
            <InlineEdit label="Root Cause Category" name="rootCauseCategory" value={capa.root_cause_category || ""} type="select"
              options={["PEOPLE", "PROCESS", "TECHNOLOGY", "THIRD_PARTY", "EXTERNAL_REGULATORY"]} onSave={handleSaveField} />
            <InlineEdit label="Analysis Method" name="analysisMethod" value={capa.analysis_method || ""} type="select"
              options={["FIVE_WHYS", "FISHBONE", "FAULT_TREE", "TREND_ANALYSIS"]} onSave={handleSaveField} />
            <InlineEdit label="Root Cause Summary" name="rootCause" value={capa.root_cause || ""} type="textarea" onSave={handleSaveField} />

            {/* Method Reference Cards */}
            {capa.analysis_method && (
              <div style={{ marginTop: 16, padding: 12, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", marginBottom: 6 }}>
                  Analysis Method: {ANALYSIS_LABELS[capa.analysis_method] || capa.analysis_method}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {capa.analysis_method === "FIVE_WHYS" && "Ask 'Why?' five times to drill down from the symptom to the root cause. Document each answer."}
                  {capa.analysis_method === "FISHBONE" && "Map causes across People, Process, Technology, Environment, Materials, and Management categories."}
                  {capa.analysis_method === "FAULT_TREE" && "Work backwards from the failure event using AND/OR logic gates to identify contributing factors."}
                  {capa.analysis_method === "TREND_ANALYSIS" && "Analyse historical data to identify patterns, recurring issues, and systemic weaknesses."}
                </div>
              </div>
            )}
          </div>

          {/* Action & Verification Tab */}
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 8 }}>Action Plan</div>
              <InlineEdit label="Action Plan" name="actionPlan" value={capa.action_plan || ""} type="textarea" onSave={handleSaveField} />
              <InlineEdit label="Completed Date" name="completedDate" value={capa.completed_date ? String(capa.completed_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
            </div>
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 8 }}>Effectiveness Verification</div>
              <InlineEdit label="Verification Method" name="verificationMethod" value={capa.verification_method || ""} type="textarea" onSave={handleSaveField} />
              <InlineEdit label="Effectiveness Review" name="effectivenessReview" value={capa.effectiveness_review || ""} type="textarea" onSave={handleSaveField} />
              <InlineEdit label="Effectiveness Status" name="effectivenessStatus" value={capa.effectiveness_status || ""} type="select"
                options={["EFFECTIVE", "PARTIALLY_EFFECTIVE", "NOT_EFFECTIVE"]} onSave={handleSaveField} />
              <InlineEdit label="Verified By" name="verifiedBy" value={capa.verified_by || ""} onSave={handleSaveField} />
              <InlineEdit label="Verified Date" name="verifiedDate" value={capa.verified_date ? String(capa.verified_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
            </div>
          </div>

          {/* Closure Tab */}
          <div>
            <div style={{ padding: 16, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                Closure requires separation of duties — the person closing the CAPA should be different from the action owner.
              </div>
            </div>
            <InlineEdit label="Closure Approved By" name="closureApprovedBy" value={capa.closure_approved_by || ""} onSave={handleSaveField} />
            <InlineEdit label="Closure Comments" name="closureComments" value={capa.closure_comments || ""} type="textarea" onSave={handleSaveField} />

            {/* Closure Readiness Check */}
            <div style={{ marginTop: 20, padding: 16, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 12 }}>Closure Readiness</div>
              {[
                { label: "Root cause identified", ok: !!capa.root_cause },
                { label: "Action plan defined", ok: !!capa.action_plan },
                { label: "Actions completed", ok: !!capa.completed_date },
                { label: "Effectiveness verified", ok: !!capa.effectiveness_status },
                { label: "Closure approved by", ok: !!capa.closure_approved_by },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 18, height: 18, borderRadius: "50%", fontSize: 11, fontWeight: 700,
                    background: item.ok ? "#22c55e" : "#e5e7eb", color: item.ok ? "#fff" : "#9ca3af",
                  }}>
                    {item.ok ? "✓" : "—"}
                  </span>
                  <span style={{ fontSize: 13, color: item.ok ? "#111" : "#9ca3af" }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Tab */}
          <div>
            <EvidencePanel
              entityType="CAPA"
              entityId={capa.id}
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

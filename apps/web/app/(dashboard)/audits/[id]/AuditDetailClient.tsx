"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, InlineEdit, DeleteButton, StatusDropdown, SendToRiskButton } from "../../ActionComponents";
import EvidencePanel from "../../EvidencePanel";
import type { Audit, Finding } from "../../../../lib/types";

export default function AuditDetailClient({
  audit,
  findings,
  evidence,
  activity,
  updateAudit,
  deleteAudit,
  createFinding,
  updateFinding,
  deleteFinding,
  sendFindingToRisk,
  uploadEvidence,
  deleteEvidence,
  role,
}: {
  audit: Audit;
  findings: Finding[];
  evidence: any[];
  activity: any[];
  updateAudit: (id: string, data: Record<string, any>) => Promise<void>;
  deleteAudit: (id: string) => Promise<void>;
  createFinding: (auditId: string, formData: FormData) => Promise<void>;
  updateFinding: (id: string, data: Record<string, any>) => Promise<void>;
  deleteFinding: (id: string, auditId: string) => Promise<void>;
  sendFindingToRisk: (findingId: string) => Promise<any>;
  uploadEvidence: (entityType: string, entityId: string, formData: FormData) => Promise<any>;
  deleteEvidence: (fileId: string) => Promise<any>;
  role: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const canEdit = role !== "VIEWER";

  const handleSaveField = async (name: string, value: string) => {
    const fieldMap: Record<string, string> = {
      title: "title",
      type: "type",
      scope: "scope",
      auditor: "auditor",
      startDate: "startDate",
      endDate: "endDate",
    };
    const apiField = fieldMap[name] || name;
    await updateAudit(audit.id, { [apiField]: value });
    router.refresh();
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateAudit(audit.id, { status: newStatus });
    router.refresh();
  };

  const handleDelete = async () => {
    await deleteAudit(audit.id);
    router.push("/audits");
  };

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <a href="/audits" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>← Back to Audits</a>
          <h1 className="page-title" style={{ marginTop: 4 }}>{audit.title}</h1>
          <p className="page-subtitle">
            {audit.type} · {audit.auditor || "No auditor"} · {audit.start_date ? String(audit.start_date).slice(0, 10) : "No date"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusDropdown
            currentStatus={audit.status}
            options={["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]}
            onStatusChange={handleStatusChange}
          />
          {canEdit && <DeleteButton onDelete={handleDelete} />}
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <Tabs tabs={["Details", `Findings (${findings.length})`, "Evidence", "Activity"]}>
          {/* Details Tab */}
          <div>
            <InlineEdit label="Title" name="title" value={audit.title} onSave={handleSaveField} />
            <InlineEdit label="Type" name="type" value={audit.type} type="select" options={["INTERNAL", "EXTERNAL", "CERTIFICATION"]} onSave={handleSaveField} />
            <InlineEdit label="Auditor" name="auditor" value={audit.auditor || ""} onSave={handleSaveField} />
            <InlineEdit label="Scope" name="scope" value={audit.scope || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="Start Date" name="startDate" value={audit.start_date ? String(audit.start_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
            <InlineEdit label="End Date" name="endDate" value={audit.end_date ? String(audit.end_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
          </div>

          {/* Findings Tab */}
          <div>
            {/* Add Finding Form */}
            {canEdit && <div style={{ marginBottom: 20, padding: 16, background: "#f9fafb", borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Add Finding</div>
              <form
                action={async (formData: FormData) => {
                  await createFinding(audit.id, formData);
                  router.refresh();
                }}
                className="form-grid"
              >
                <div className="form-group form-full">
                  <input name="title" className="form-input" placeholder="Finding title" required />
                </div>
                <div className="form-group">
                  <select name="severity" className="form-select" defaultValue="MEDIUM">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <input name="dueDate" type="date" className="form-input" />
                </div>
                <div className="form-group form-full">
                  <textarea name="recommendation" className="form-textarea" placeholder="Recommendation..." />
                </div>
                <div className="form-full">
                  <button type="submit" className="btn btn-primary" style={{ fontSize: 12, padding: "6px 14px" }}>Add Finding</button>
                </div>
              </form>
            </div>}

            {/* Findings List */}
            {findings.map((f) => (
              <div key={f.id} className="table-card" style={{ marginBottom: 10, padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{f.title}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                      Due: {f.due_date ? String(f.due_date).slice(0, 10) : "—"} · {f.recommendation || "No recommendation"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <span className={`badge badge-${f.severity.toLowerCase()}`}>{f.severity}</span>
                    <StatusDropdown
                      currentStatus={f.status}
                      options={["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED"]}
                      onStatusChange={async (s) => { await updateFinding(f.id, { status: s }); router.refresh(); }}
                    />
                    {canEdit && <SendToRiskButton onSend={async () => { await sendFindingToRisk(f.id); }} />}
                    {canEdit && <DeleteButton
                      label="✕"
                      onDelete={async () => { await deleteFinding(f.id, audit.id); router.refresh(); }}
                    />}
                  </div>
                </div>
              </div>
            ))}
            {findings.length === 0 && (
              <div style={{ textAlign: "center", padding: 24, color: "#9ca3af", fontSize: 13 }}>No findings yet.</div>
            )}
          </div>

          {/* Evidence Tab */}
          <div>
            <EvidencePanel
              entityType="AUDIT"
              entityId={audit.id}
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

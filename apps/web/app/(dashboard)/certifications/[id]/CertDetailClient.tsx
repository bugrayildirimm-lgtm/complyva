"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, InlineEdit, DeleteButton, StatusDropdown } from "../../ActionComponents";
import EvidencePanel from "../../EvidencePanel";
import type { Certification } from "../../../../lib/types";

function daysUntilExpiry(date: string | null) {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function CertDetailClient({
  cert,
  evidence,
  activity,
  updateCertification,
  deleteCertification,
  uploadEvidence,
  deleteEvidence,
  role,
}: {
  cert: Certification;
  evidence: any[];
  activity: any[];
  updateCertification: (id: string, data: Record<string, any>) => Promise<void>;
  deleteCertification: (id: string) => Promise<void>;
  uploadEvidence: (entityType: string, entityId: string, formData: FormData) => Promise<any>;
  deleteEvidence: (fileId: string) => Promise<any>;
  role: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const canEdit = role !== "VIEWER";

  const handleSaveField = async (name: string, value: string) => {
    await updateCertification(cert.id, { [name]: value });
    router.refresh();
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateCertification(cert.id, { status: newStatus });
    router.refresh();
  };

  const handleDelete = async () => {
    await deleteCertification(cert.id);
    router.push("/certifications");
  };

  const days = daysUntilExpiry(cert.expiry_date);

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <a href="/certifications" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>← Back to Certifications</a>
          <h1 className="page-title" style={{ marginTop: 4 }}>{cert.name}</h1>
          <p className="page-subtitle">
            {cert.framework_type || "No framework"} · {cert.issuing_body || "No issuing body"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusDropdown
            currentStatus={cert.status}
            options={["ACTIVE", "EXPIRED", "REVOKED", "SUSPENDED"]}
            onStatusChange={handleStatusChange}
          />
          {canEdit && <DeleteButton onDelete={handleDelete} />}
        </div>
      </div>

      {/* Expiry Banner */}
      {days !== null && days > 0 && days <= 60 && (
        <div style={{
          background: days <= 30 ? "#fef2f2" : "#fef3c7",
          border: `1px solid ${days <= 30 ? "#ef4444" : "#f59e0b"}`,
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 16,
          fontSize: 13,
          color: days <= 30 ? "#991b1b" : "#92400e",
        }}>
          ⚠️ This certification expires in <strong>{days} days</strong> ({String(cert.expiry_date).slice(0, 10)}).
          {days <= 30 ? " Renewal is urgent." : " Plan for renewal soon."}
        </div>
      )}
      {days !== null && days <= 0 && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #ef4444",
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 16,
          fontSize: 13,
          color: "#991b1b",
        }}>
          🚨 This certification <strong>expired {Math.abs(days)} days ago</strong> ({String(cert.expiry_date).slice(0, 10)}).
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: "16px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 6 }}>
            Status
          </div>
          <span className={`badge badge-${cert.status.toLowerCase()}`} style={{ fontSize: 14, padding: "4px 14px" }}>
            {cert.status}
          </span>
        </div>
        <div className="card" style={{ padding: "16px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 6 }}>
            Issued
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>
            {cert.issue_date ? String(cert.issue_date).slice(0, 10) : "—"}
          </div>
        </div>
        <div className="card" style={{ padding: "16px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 6 }}>
            Expires
          </div>
          <div style={{
            fontSize: 15,
            fontWeight: 600,
            color: days !== null && days <= 30 ? "#ef4444" : days !== null && days <= 60 ? "#f59e0b" : "#111",
          }}>
            {cert.expiry_date ? String(cert.expiry_date).slice(0, 10) : "—"}
          </div>
          {days !== null && days > 0 && (
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{days} days remaining</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <Tabs tabs={["Details", "Evidence", "Activity"]}>
          {/* Details Tab */}
          <div>
            <InlineEdit label="Name" name="name" value={cert.name} onSave={handleSaveField} />
            <InlineEdit label="Framework Type" name="frameworkType" value={cert.framework_type || ""} onSave={handleSaveField} />
            <InlineEdit label="Issuing Body" name="issuingBody" value={cert.issuing_body || ""} onSave={handleSaveField} />
            <InlineEdit label="Issue Date" name="issueDate" value={cert.issue_date ? String(cert.issue_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
            <InlineEdit label="Expiry Date" name="expiryDate" value={cert.expiry_date ? String(cert.expiry_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
            <InlineEdit label="Notes" name="notes" value={cert.notes || ""} type="textarea" onSave={handleSaveField} />
          </div>

          {/* Evidence Tab */}
          <div>
            <EvidencePanel
              entityType="CERTIFICATION"
              entityId={cert.id}
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

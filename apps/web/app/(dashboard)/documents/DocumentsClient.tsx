"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDocument } from "../../../lib/api";
import type { Document } from "../../../lib/types";
import ExportButton from "../ExportButton";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#f3f4f6", color: "#374151" },
  IN_REVIEW: { bg: "#fffbeb", color: "#92400e" },
  APPROVED: { bg: "#f0fdf4", color: "#16a34a" },
  SUPERSEDED: { bg: "#f5f3ff", color: "#7c3aed" },
  ARCHIVED: { bg: "#f9fafb", color: "#6b7280" },
};

const CLASS_COLORS: Record<string, string> = {
  PUBLIC: "#22c55e", INTERNAL: "#3b82f6", CONFIDENTIAL: "#f59e0b", RESTRICTED: "#ef4444",
};

const CATEGORIES = [
  "INFORMATION_SECURITY", "DATA_PROTECTION", "HR", "OPERATIONS", "RISK_MANAGEMENT",
  "BUSINESS_CONTINUITY", "GOVERNANCE", "IT", "LEGAL", "QUALITY", "COMPLIANCE", "OTHER",
];

const ARTEFACT_TYPES = ["PROCEDURE", "STANDARD", "GUIDELINE", "TEMPLATE", "SOP", "WORK_INSTRUCTION"];

function docId(num: number) {
  return `DOC-${String(num).padStart(3, "0")}`;
}

export default function DocumentsClient({ documents, role }: { documents: Document[]; role: string }) {
  const [tab, setTab] = useState<"POLICIES" | "ARTEFACTS">("POLICIES");
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const policies = documents.filter((d) => d.doc_type === "POLICY");
  const artefacts = documents.filter((d) => d.doc_type !== "POLICY");
  const currentDocs = tab === "POLICIES" ? policies : artefacts;

  const now = new Date();
  const overdueReview = currentDocs.filter(
    (d) => d.next_review_date && new Date(d.next_review_date) < now && !["ARCHIVED", "SUPERSEDED"].includes(d.status)
  );
  const drafts = currentDocs.filter((d) => d.status === "DRAFT");
  const approved = currentDocs.filter((d) => d.status === "APPROVED");

  async function handleCreate(formData: FormData) {
    const data: any = {
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      docType: tab === "POLICIES" ? "POLICY" : formData.get("docType"),
      category: formData.get("category") || undefined,
      classification: formData.get("classification") || "INTERNAL",
      owner: formData.get("owner") || undefined,
      reviewer: formData.get("reviewer") || undefined,
      approver: formData.get("approver") || undefined,
      nextReviewDate: formData.get("nextReviewDate") || undefined,
      linkedFrameworks: formData.get("linkedFrameworks") || undefined,
    };
    startTransition(async () => {
      await createDocument(data);
      router.refresh();
      setShowForm(false);
    });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Documents</h1>
          <p className="page-subtitle">Policies, procedures, standards and guidelines</p>
        </div>
        <ExportButton type="documents" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
        {(["POLICIES", "ARTEFACTS"] as const).map((t) => {
          const count = t === "POLICIES" ? policies.length : artefacts.length;
          return (
            <button key={t} onClick={() => { setTab(t); setShowForm(false); }}
              style={{
                padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: "none", border: "none",
                borderBottom: tab === t ? "2px solid #111" : "2px solid transparent",
                color: tab === t ? "#111" : "#6b7280",
                marginBottom: -2,
              }}>
              {t === "POLICIES" ? "Policies" : "Artefacts"} ({count})
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: "12px 16px", textAlign: "center", borderLeft: "3px solid #3b82f6" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{currentDocs.length}</div>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Total</div>
        </div>
        <div className="card" style={{ padding: "12px 16px", textAlign: "center", borderLeft: "3px solid #16a34a" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#16a34a" }}>{approved.length}</div>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Approved</div>
        </div>
        <div className="card" style={{ padding: "12px 16px", textAlign: "center", borderLeft: "3px solid #6b7280" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#6b7280" }}>{drafts.length}</div>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Drafts</div>
        </div>
        <div className="card" style={{ padding: "12px 16px", textAlign: "center", borderLeft: `3px solid ${overdueReview.length > 0 ? "#ef4444" : "#22c55e"}` }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: overdueReview.length > 0 ? "#ef4444" : "#22c55e" }}>{overdueReview.length}</div>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>Overdue Review</div>
        </div>
      </div>

      {overdueReview.length > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>
          <strong>{overdueReview.length}</strong> document{overdueReview.length > 1 ? "s" : ""} overdue for review
        </div>
      )}

      {/* Create Form */}
      {role !== "VIEWER" && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary" style={{ fontSize: 13 }}>
            {showForm ? "Cancel" : `+ New ${tab === "POLICIES" ? "Policy" : "Document"}`}
          </button>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <form action={handleCreate} className="form-grid">
            <div className="form-group form-full">
              <label className="form-label">Title *</label>
              <input name="title" className="form-input" required placeholder={tab === "POLICIES" ? "e.g. Information Security Policy" : "e.g. Incident Response Procedure"} />
            </div>
            {tab === "ARTEFACTS" && (
              <div className="form-group">
                <label className="form-label">Type</label>
                <select name="docType" className="form-input">
                  {ARTEFACT_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Category</label>
              <select name="category" className="form-input">
                <option value="">Select...</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Classification</label>
              <select name="classification" className="form-input">
                <option value="PUBLIC">Public</option>
                <option value="INTERNAL" selected>Internal</option>
                <option value="CONFIDENTIAL">Confidential</option>
                <option value="RESTRICTED">Restricted</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Owner</label>
              <input name="owner" className="form-input" placeholder="Responsible person" />
            </div>
            <div className="form-group">
              <label className="form-label">Reviewer</label>
              <input name="reviewer" className="form-input" placeholder="Who reviews" />
            </div>
            <div className="form-group">
              <label className="form-label">Approver</label>
              <input name="approver" className="form-input" placeholder="Who approves" />
            </div>
            <div className="form-group">
              <label className="form-label">Next Review Date</label>
              <input name="nextReviewDate" type="date" className="form-input" />
            </div>
            <div className="form-group form-full">
              <label className="form-label">Linked Frameworks</label>
              <input name="linkedFrameworks" className="form-input" placeholder="e.g. ISO 27001 A.5.1, GDPR Art.30" />
            </div>
            <div className="form-group form-full">
              <label className="form-label">Description</label>
              <textarea name="description" className="form-textarea" placeholder="Brief description of this document..." />
            </div>
            <div className="form-full">
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? "Creating..." : `Create ${tab === "POLICIES" ? "Policy" : "Document"}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              {tab === "ARTEFACTS" && <th>Type</th>}
              <th>Category</th>
              <th>Classification</th>
              <th>Version</th>
              <th>Status</th>
              <th>Review Date</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {currentDocs.map((d) => {
              const sc = STATUS_COLORS[d.status] || STATUS_COLORS.DRAFT;
              const isOverdue = d.next_review_date && new Date(d.next_review_date) < now && !["ARCHIVED", "SUPERSEDED"].includes(d.status);
              return (
                <tr key={d.id}>
                  <td style={{ fontSize: 12, fontWeight: 600, fontFamily: "monospace", color: "#6b7280" }}>
                    {docId(d.doc_number)}
                  </td>
                  <td>
                    <a href={`/documents/${d.id}`} style={{ fontWeight: 550, color: "#111", textDecoration: "none" }}>{d.title}</a>
                    {d.owner && <div style={{ fontSize: 11, color: "#9ca3af" }}>Owner: {d.owner}</div>}
                  </td>
                  {tab === "ARTEFACTS" && (
                    <td style={{ fontSize: 12, color: "#374151" }}>{d.doc_type.replace(/_/g, " ")}</td>
                  )}
                  <td style={{ fontSize: 12, color: "#6b7280" }}>{d.category ? d.category.replace(/_/g, " ") : ""}</td>
                  <td>
                    {d.classification && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                        color: "#fff", background: CLASS_COLORS[d.classification] || "#6b7280",
                      }}>
                        {d.classification}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>v{d.current_version}</td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 10,
                      color: sc.color, background: sc.bg,
                    }}>
                      {d.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: isOverdue ? "#ef4444" : "#374151", fontWeight: isOverdue ? 600 : 400 }}>
                    {d.next_review_date ? String(d.next_review_date).slice(0, 10) : ""}{isOverdue && " !"}
                  </td>
                  <td>
                    <a href={`/documents/${d.id}`} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>Open</a>
                  </td>
                </tr>
              );
            })}
            {currentDocs.length === 0 && (
              <tr><td colSpan={tab === "ARTEFACTS" ? 9 : 8} style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>
                  No {tab === "POLICIES" ? "policies" : "artefacts"} yet
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  {tab === "POLICIES"
                    ? "Policies define your organisation's rules and commitments. Create one above."
                    : "Artefacts include procedures, standards, and guidelines. Create one above."}
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

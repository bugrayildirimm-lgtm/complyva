"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, InlineEdit, DeleteButton, StatusDropdown } from "../../ActionComponents";
import { uploadDocumentVersion } from "../../../../lib/api";
import type { Document, DocumentVersion } from "../../../../lib/types";

const STATUS_OPTIONS = ["DRAFT", "IN_REVIEW", "APPROVED", "SUPERSEDED", "ARCHIVED"];
const CLASS_COLORS: Record<string, string> = { PUBLIC: "#22c55e", INTERNAL: "#3b82f6", CONFIDENTIAL: "#f59e0b", RESTRICTED: "#ef4444" };

export default function DocumentDetailClient({
  doc, versions, activity, updateDocument, deleteDocument, role,
}: {
  doc: Document; versions: DocumentVersion[]; activity: any[];
  updateDocument: (id: string, data: any) => Promise<any>;
  deleteDocument: (id: string) => Promise<any>;
  role: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [changeNotes, setChangeNotes] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const canEdit = role !== "VIEWER";

  async function save(name: string, value: string) {
    await updateDocument(doc.id, { [name]: value });
    router.refresh();
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) return;
    if (!versionLabel.trim()) { alert("Please enter a version label"); return; }
    setUploading(true);
    try {
      await uploadDocumentVersion(doc.id, file, versionLabel.trim(), changeNotes || undefined);
      setChangeNotes("");
      setVersionLabel("");
      router.refresh();
    } catch (err) {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const isOverdue = doc.next_review_date && new Date(doc.next_review_date) < new Date() && !["ARCHIVED", "SUPERSEDED"].includes(doc.status);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <a href="/documents" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>Documents</a>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 13, color: "#111", fontWeight: 600 }}>DOC-{String(doc.doc_number).padStart(3, "0")}</span>
        <span style={{
          marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
          color: "#fff", background: CLASS_COLORS[doc.classification || "INTERNAL"] || "#6b7280",
        }}>
          {doc.classification || "INTERNAL"}
        </span>
        {isOverdue && (
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fef2f2", padding: "2px 10px", borderRadius: 10 }}>
            OVERDUE FOR REVIEW
          </span>
        )}
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <InlineEdit label="Title" name="title" value={doc.title} onSave={save} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#374151", background: "#f3f4f6", padding: "3px 10px", borderRadius: 6 }}>v{doc.current_version}</span>
            <StatusDropdown currentStatus={doc.status} options={STATUS_OPTIONS} onStatusChange={async (s) => { await save("status", s); }} />
            <DeleteButton onDelete={async () => { await deleteDocument(doc.id); router.push("/documents"); }} label="Delete" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Type</div>
            <div style={{ fontSize: 13, color: "#111" }}>{doc.doc_type.replace(/_/g, " ")}</div>
          </div>
          <InlineEdit label="Category" name="category" value={doc.category || ""} onSave={save} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Classification</div>
            <select value={doc.classification || "INTERNAL"} onChange={(e) => save("classification", e.target.value)} disabled={!canEdit}
              style={{ fontSize: 13, border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", background: "#fff" }}>
              {["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <InlineEdit label="Owner" name="owner" value={doc.owner || ""} onSave={save} />
          <InlineEdit label="Reviewer" name="reviewer" value={doc.reviewer || ""} onSave={save} />
          <InlineEdit label="Approver" name="approver" value={doc.approver || ""} onSave={save} />
          <InlineEdit label="Effective Date" name="effectiveDate" value={doc.effective_date ? String(doc.effective_date).slice(0, 10) : ""} type="date" onSave={save} />
          <InlineEdit label="Next Review Date" name="nextReviewDate" value={doc.next_review_date ? String(doc.next_review_date).slice(0, 10) : ""} type="date" onSave={save} />
          <InlineEdit label="Linked Frameworks" name="linkedFrameworks" value={doc.linked_frameworks || ""} onSave={save} />
        </div>

        <div style={{ marginTop: 16, borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
          <InlineEdit label="Description" name="description" value={doc.description || ""} type="textarea" onSave={save} />
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <Tabs tabs={["Versions", "Activity"]}>
          <div>
            {canEdit && (
              <form onSubmit={handleUpload} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Version *</label>
                  <input value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} required
                    placeholder="e.g. 1.0, 2.1, v3"
                    style={{ width: 100, fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>File *</label>
                  <input type="file" required style={{ fontSize: 12 }} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Change Notes</label>
                  <input value={changeNotes} onChange={(e) => setChangeNotes(e.target.value)}
                    placeholder="What changed in this version..."
                    style={{ width: "100%", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px" }} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={uploading} style={{ fontSize: 12, padding: "6px 16px" }}>
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </form>
            )}

            {versions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "#9ca3af", fontSize: 13 }}>
                No versions uploaded yet. Upload the first version above.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                    {["Version", "File", "Size", "Uploaded By", "Notes", "Date", ""].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v: DocumentVersion, i: number) => (
                    <tr key={v.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 700, color: "#111" }}>
                        v{v.version_label}
                        {i === 0 && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#16a34a", background: "#f0fdf4", padding: "1px 6px", borderRadius: 8, marginLeft: 6 }}>Current</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#374151" }}>{v.file_name}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280" }}>
                        {v.file_size ? `${(v.file_size / 1024).toFixed(0)} KB` : ""}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280" }}>{v.uploaded_by_name || ""}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280", fontStyle: v.change_notes ? "italic" : "normal" }}>
                        {v.change_notes || ""}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#9ca3af" }}>
                        {new Date(v.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <a href={`/api/documents/versions/${v.id}/download`}
                          style={{ fontSize: 12, color: "#0891b2", fontWeight: 600, textDecoration: "none" }}>
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

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

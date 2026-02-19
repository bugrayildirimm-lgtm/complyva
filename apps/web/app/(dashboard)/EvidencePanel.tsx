/* eslint-disable no-restricted-globals */
"use client";

declare function alert(message?: any): void;
declare function confirm(message?: string): boolean;

import { useState } from "react";

type EvidenceFile = {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
};

export default function EvidencePanel({
  entityType,
  entityId,
  files,
  uploadAction,
  deleteAction,
}: {
  entityType: string;
  entityId: string;
  files: EvidenceFile[];
  uploadAction: (entityType: string, entityId: string, formData: FormData) => Promise<any>;
  deleteAction: (fileId: string) => Promise<any>;
}) {
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<EvidenceFile[]>(files);

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleUpload(formData: FormData) {
    setUploading(true);
    try {
      const result = await uploadAction(entityType, entityId, formData);
      setFileList((prev) => [
        {
          id: result.id,
          file_name: result.file_name,
          mime_type: result.mime_type,
          file_size: result.file_size,
          uploaded_at: result.uploaded_at,
        },
        ...prev,
      ]);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    }
    setUploading(false);
  }

  async function handleDelete(fileId: string) {
    if (!confirm("Delete this file?")) return;
    try {
      await deleteAction(fileId);
      setFileList((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err: any) {
      alert(err.message || "Delete failed");
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>
          Evidence Files
        </div>
        <span className="badge badge-planned">{fileList.length} file{fileList.length !== 1 ? "s" : ""}</span>
      </div>

      <form
        action={handleUpload}
        style={{
          display: "flex", gap: 10, alignItems: "center",
          padding: 12, background: "#f8f9fa", borderRadius: 8,
          border: "1px dashed #d1d5db", marginBottom: 14,
        }}
      >
        <input
          type="file"
          name="file"
          required
          style={{ flex: 1, fontSize: 13 }}
        />
        <button
          type="submit"
          disabled={uploading}
          className="btn btn-primary"
          style={{ padding: "6px 14px", fontSize: 12 }}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </form>

      {fileList.length === 0 ? (
        <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 0" }}>
          No evidence files yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {fileList.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: 8,
                border: "1px solid #e8eaed", background: "#fff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.file_name}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    {formatSize(f.file_size)} · {new Date(f.uploaded_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => handleDelete(f.id)}
                  style={{
                    padding: "4px 8px", borderRadius: 6, border: "1px solid #e8eaed",
                    background: "#fff", fontSize: 11, color: "#dc2626", cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
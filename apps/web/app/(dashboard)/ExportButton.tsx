"use client";

export default function ExportButton({ type }: { type: string }) {
  return (
    <a
      href={`/api/export?type=${type}`}
      className="btn btn-secondary"
      style={{ padding: "6px 14px", fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      ↓ Export Excel
    </a>
  );
}

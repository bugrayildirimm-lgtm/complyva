import { createCertification, getCertifications } from "../../../lib/api";
import type { Certification } from "../../../lib/types";
import ExportButton from "../ExportButton";

export default async function CertificationsPage() {
  const rows: Certification[] = await getCertifications();

  function isExpiringSoon(date: string | null) {
    if (!date) return false;
    const diff = new Date(date).getTime() - Date.now();
    return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Certifications</h1>
          <p className="page-subtitle">Track certification lifecycle and renewals</p>
        </div>
        <ExportButton type="certifications" />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#111" }}>Add Certification</div>
        <form action={createCertification} className="form-grid">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input name="name" className="form-input" placeholder="ISO 27001" required />
          </div>
          <div className="form-group">
            <label className="form-label">Framework Type</label>
            <input name="frameworkType" className="form-input" placeholder="ISO / SOC2 / PCI..." />
          </div>
          <div className="form-group">
            <label className="form-label">Issuing Body</label>
            <input name="issuingBody" className="form-input" placeholder="Certification Body" />
          </div>
          <div className="form-group">
            <label className="form-label">Issue Date</label>
            <input name="issueDate" type="date" className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Expiry Date</label>
            <input name="expiryDate" type="date" className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input name="notes" className="form-input" placeholder="Optional notes" />
          </div>
          <div className="form-full">
            <button type="submit" className="btn btn-primary">Create Certification</button>
          </div>
        </form>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Framework</th>
              <th>Issuing Body</th>
              <th>Issue Date</th>
              <th>Expiry Date</th>
              <th>Status</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <a href={`/certifications/${c.id}`} style={{ fontWeight: 550, color: "#111", textDecoration: "none" }}>
                    {c.name}
                  </a>
                </td>
                <td style={{ fontSize: 13 }}>{c.framework_type || "—"}</td>
                <td style={{ fontSize: 13 }}>{c.issuing_body || "—"}</td>
                <td style={{ fontSize: 13 }}>{c.issue_date ? String(c.issue_date).slice(0, 10) : "—"}</td>
                <td style={{ fontSize: 13 }}>
                  {c.expiry_date ? (
                    <span style={{ color: isExpiringSoon(c.expiry_date) ? "#f59e0b" : undefined, fontWeight: isExpiringSoon(c.expiry_date) ? 600 : undefined }}>
                      {String(c.expiry_date).slice(0, 10)}
                      {isExpiringSoon(c.expiry_date) && " ⚠"}
                    </span>
                  ) : "—"}
                </td>
                <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
                <td>
                  <a href={`/certifications/${c.id}`} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>Open →</a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 32 }}>No certifications yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

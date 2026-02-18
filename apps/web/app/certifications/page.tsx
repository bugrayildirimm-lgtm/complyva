import { createCertification, getCertifications } from "../../lib/api";
import type { Certification } from "../../lib/types";

export default async function CertificationsPage() {
  const rows: Certification[] = await getCertifications();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Certifications</h1>
          <p className="page-subtitle">Track certification lifecycle and renewals</p>
        </div>
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
              <th>Expiry</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.framework_type ?? "-"}</td>
                <td>{c.issuing_body ?? "-"}</td>
                <td className="tabular">{c.expiry_date ? String(c.expiry_date).slice(0, 10) : "-"}</td>
                <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="muted">No certifications yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
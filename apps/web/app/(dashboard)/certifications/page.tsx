import { createCertification, getCertifications, getEvidence, uploadEvidence, deleteEvidence } from "../../lib/api";
import type { Certification } from "../../lib/types";
import EvidencePanel from "../EvidencePanel";

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

      {rows.map(async (c) => {
        const files = await getEvidence("CERTIFICATION", c.id);
        return (
          <div key={c.id} className="table-card" style={{ marginBottom: 16, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                  {c.framework_type ?? "-"} · {c.issuing_body ?? "-"} · Expires: {c.expiry_date ? String(c.expiry_date).slice(0, 10) : "-"}
                </div>
              </div>
              <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
            </div>
            <EvidencePanel
              entityType="CERTIFICATION"
              entityId={c.id}
              files={files}
              uploadAction={uploadEvidence}
              deleteAction={deleteEvidence}
            />
          </div>
        );
      })}

      {rows.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div className="muted">No certifications yet. Create one above.</div>
        </div>
      )}
    </>
  );
}
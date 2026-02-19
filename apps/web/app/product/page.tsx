export default function ProductPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Product</h1>
          <p className="page-subtitle">Everything your team needs to run compliance continuously.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 className="feature-title">Unified Compliance Workspace</h3>
          <p className="feature-copy">Centralize certifications, risks, audits, findings, and evidence in one place.</p>
        </div>
        <div className="card">
          <h3 className="feature-title">Role-Based Access</h3>
          <p className="feature-copy">Keep teams aligned with admin, auditor, and viewer permission controls.</p>
        </div>
        <div className="card">
          <h3 className="feature-title">Activity Tracking</h3>
          <p className="feature-copy">Maintain an auditable timeline of who changed what and when.</p>
        </div>
        <div className="card">
          <h3 className="feature-title">Proactive Alerts</h3>
          <p className="feature-copy">Receive reminders before certification expiries, due dates, and audits.</p>
        </div>
      </div>
    </>
  );
}

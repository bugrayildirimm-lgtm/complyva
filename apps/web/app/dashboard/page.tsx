import { getSummary } from "../../lib/api";

export default async function Dashboard() {
  const s = await getSummary();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Compliance posture overview</p>
        </div>
      </div>

      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-label">Expiring Certs (60d)</div>
          <div className="metric-value">{s.expiringSoon}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Open Risks</div>
          <div className="metric-value">{s.openRisks}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Open Findings</div>
          <div className="metric-value">{s.openFindings}</div>
        </div>
      </div>
    </>
  );
}
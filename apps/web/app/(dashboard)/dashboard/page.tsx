import { getSummary } from "../../../lib/api";

export default async function Dashboard() {
  const s = await getSummary();

  function scoreClass(score: number) {
    if (score >= 20) return "score-critical";
    if (score >= 10) return "score-high";
    if (score >= 5) return "score-medium";
    return "score-low";
  }

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
        <div className="metric-card">
          <div className="metric-label">Active Audits</div>
          <div className="metric-value">{s.activeAudits}</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Recent Risks */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 14 }}>
            Recent Risks
          </div>
          {s.recentRisks && s.recentRisks.length > 0 ? (
            s.recentRisks.map((r: any) => (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 0", borderBottom: "1px solid #f3f4f6",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>{r.category ?? "-"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`score-badge ${scoreClass(r.inherent_score)}`}>{r.inherent_score}</span>
                  <span className={`badge badge-${r.status.toLowerCase()}`}>{r.status.replace(/_/g, " ")}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: "#9ca3af", padding: "10px 0" }}>No risks yet.</div>
          )}
        </div>

        {/* Upcoming Audits */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 14 }}>
            Upcoming Audits
          </div>
          {s.upcomingAudits && s.upcomingAudits.length > 0 ? (
            s.upcomingAudits.map((a: any) => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 0", borderBottom: "1px solid #f3f4f6",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{a.title}</div>
                  <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>
                    {a.start_date ? String(a.start_date).slice(0, 10) : "-"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`badge badge-${a.type.toLowerCase()}`}>{a.type}</span>
                  <span className={`badge badge-${a.status.toLowerCase()}`}>{a.status.replace(/_/g, " ")}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: "#9ca3af", padding: "10px 0" }}>No audits yet.</div>
          )}
        </div>
      </div>
    </>
  );
}
import { getSummary } from "../../../lib/api";
import Link from "next/link";

function scoreColor(score: number) {
  if (score >= 20) return "#ef4444";
  if (score >= 15) return "#f59e0b";
  if (score >= 10) return "#eab308";
  if (score >= 5) return "#3b82f6";
  return "#22c55e";
}

function riskLevel(score: number) {
  if (score >= 20) return "CRITICAL";
  if (score >= 15) return "HIGH";
  if (score >= 10) return "MEDIUM";
  if (score >= 5) return "LOW";
  return "VERY LOW";
}

export default async function DashboardPage() {
  const s = await getSummary();

  // Collect alerts
  const alerts: { level: "red" | "amber" | "blue"; message: string; link: string }[] = [];
  if (s.criticalIncidents > 0) alerts.push({ level: "red", message: `${s.criticalIncidents} critical incident${s.criticalIncidents > 1 ? "s" : ""} unresolved`, link: "/incidents" });
  if (s.overdueNCs > 0) alerts.push({ level: "red", message: `${s.overdueNCs} non-conformit${s.overdueNCs > 1 ? "ies" : "y"} overdue`, link: "/nonconformities" });
  if (s.overdueCAPAs > 0) alerts.push({ level: "red", message: `${s.overdueCAPAs} CAPA${s.overdueCAPAs > 1 ? "s" : ""} past due date`, link: "/capas" });
  if (s.ineffectiveCAPAs > 0) alerts.push({ level: "red", message: `${s.ineffectiveCAPAs} CAPA${s.ineffectiveCAPAs > 1 ? "s" : ""} verified as ineffective`, link: "/capas" });
  if (s.expiringSoon > 0) alerts.push({ level: "amber", message: `${s.expiringSoon} certification${s.expiringSoon > 1 ? "s" : ""} expiring within 60 days`, link: "/certifications" });
  if (s.pendingRisks > 0) alerts.push({ level: "amber", message: `${s.pendingRisks} risk${s.pendingRisks > 1 ? "s" : ""} pending review`, link: "/risks" });
  if (s.pendingChanges > 0) alerts.push({ level: "blue", message: `${s.pendingChanges} change request${s.pendingChanges > 1 ? "s" : ""} awaiting approval`, link: "/approvals" });

  const alertColors = { red: { bg: "#fef2f2", border: "#ef4444", text: "#991b1b", icon: "🚨" }, amber: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", icon: "⚠️" }, blue: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af", icon: "ℹ️" } };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Compliance Dashboard</h1>
          <p className="page-subtitle">Real-time compliance posture across all registers</p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {alerts.map((a, i) => {
            const c = alertColors[a.level];
            return (
              <Link key={i} href={a.link} style={{ textDecoration: "none" }}>
                <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 16px", fontSize: 13, color: c.text, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>{c.icon} {a.message}</span>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>View →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Primary KPIs — 4 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <Link href="/risks" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "16px", borderLeft: "4px solid #ef4444", cursor: "pointer" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af" }}>Open Risks</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#111", marginTop: 4 }}>{s.openRisks}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.pendingRisks} pending review</div>
          </div>
        </Link>
        <Link href="/incidents" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "16px", borderLeft: "4px solid #f59e0b", cursor: "pointer" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af" }}>Open Incidents</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#111", marginTop: 4 }}>{s.openIncidents}</div>
            <div style={{ fontSize: 12, color: s.criticalIncidents > 0 ? "#ef4444" : "#6b7280", fontWeight: s.criticalIncidents > 0 ? 600 : 400, marginTop: 2 }}>
              {s.criticalIncidents > 0 ? `${s.criticalIncidents} critical` : "No critical"}
            </div>
          </div>
        </Link>
        <Link href="/nonconformities" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "16px", borderLeft: "4px solid #8b5cf6", cursor: "pointer" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af" }}>Open NCs</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#111", marginTop: 4 }}>{s.openNCs}</div>
            <div style={{ fontSize: 12, color: s.overdueNCs > 0 ? "#ef4444" : "#6b7280", fontWeight: s.overdueNCs > 0 ? 600 : 400, marginTop: 2 }}>
              {s.overdueNCs > 0 ? `${s.overdueNCs} overdue` : "None overdue"}
            </div>
          </div>
        </Link>
        <Link href="/capas" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "16px", borderLeft: "4px solid #3b82f6", cursor: "pointer" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af" }}>Open CAPAs</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#111", marginTop: 4 }}>{s.openCAPAs}</div>
            <div style={{ fontSize: 12, color: s.overdueCAPAs > 0 ? "#ef4444" : "#6b7280", fontWeight: s.overdueCAPAs > 0 ? 600 : 400, marginTop: 2 }}>
              {s.overdueCAPAs > 0 ? `${s.overdueCAPAs} overdue` : "On track"}
            </div>
          </div>
        </Link>
      </div>

      {/* Secondary KPIs — 4 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <Link href="/audits" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "14px 16px", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af" }}>Active Audits</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#111", marginTop: 2 }}>{s.activeAudits}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.openFindings > 0 ? "#f59e0b" : "#22c55e" }}>{s.openFindings}</div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>open findings</div>
              </div>
            </div>
          </div>
        </Link>
        <Link href="/certifications" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "14px 16px", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af" }}>Certifications</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#111", marginTop: 2 }}>{s.totalCerts}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.expiringSoon > 0 ? "#f59e0b" : "#22c55e" }}>{s.expiringSoon}</div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>expiring soon</div>
              </div>
            </div>
          </div>
        </Link>
        <Link href="/assets" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "14px 16px", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af" }}>Assets</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#111", marginTop: 2 }}>{s.totalAssets}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.criticalAssets > 0 ? "#f59e0b" : "#22c55e" }}>{s.criticalAssets}</div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>L3-L4 critical</div>
              </div>
            </div>
          </div>
        </Link>
        <Link href="/approvals" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "14px 16px", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af" }}>Changes</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#111", marginTop: 2 }}>{s.activeChanges}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.pendingChanges > 0 ? "#f59e0b" : "#22c55e" }}>{s.pendingChanges}</div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>pending approval</div>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Risk Distribution — Full Width */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 16 }}>Risk Distribution</div>

        {[
          { label: "Critical", count: s.risksByLevel?.critical ?? 0, color: "#ef4444" },
          { label: "High", count: s.risksByLevel?.high ?? 0, color: "#f59e0b" },
          { label: "Medium", count: s.risksByLevel?.medium ?? 0, color: "#eab308" },
          { label: "Low", count: s.risksByLevel?.low ?? 0, color: "#22c55e" },
        ].map((r) => {
          const maxCount = Math.max(s.risksByLevel?.critical ?? 0, s.risksByLevel?.high ?? 0, s.risksByLevel?.medium ?? 0, s.risksByLevel?.low ?? 0, 1);
          return (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 60, fontSize: 12, fontWeight: 600, color: "#6b7280" }}>{r.label}</div>
              <div style={{ flex: 1, height: 24, background: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${(r.count / maxCount) * 100}%`, height: "100%", background: r.color, borderRadius: 6, minWidth: r.count > 0 ? 24 : 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {r.count > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{r.count}</span>}
                </div>
              </div>
            </div>
          );
        })}

        {s.topRisks && s.topRisks.length > 0 && (
          <div style={{ marginTop: 16, borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Top Risks</div>
            {s.topRisks.map((r: any) => (
              <Link key={r.id} href={`/risks/${r.id}`} style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f9fafb" }}>
                  <span style={{ fontSize: 13, color: "#111", fontWeight: 500 }}>{r.title}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(r.inherent_score), background: `${scoreColor(r.inherent_score)}15`, padding: "2px 8px", borderRadius: 4 }}>
                    {r.inherent_score}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

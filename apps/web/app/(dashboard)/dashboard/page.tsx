import { getSummary, getEnhancedDashboard } from "../../../lib/api";
import Link from "next/link";
import type { DashboardEnhanced } from "../../../lib/types";

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

function rateColor(rate: number | null) {
  if (rate === null) return "#6b7280";
  if (rate >= 80) return "#22c55e";
  if (rate >= 60) return "#f59e0b";
  return "#ef4444";
}

function kriColor(value: number, thresholdAmber: number, thresholdRed: number) {
  if (value >= thresholdRed) return { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" };
  if (value >= thresholdAmber) return { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" };
  return { bg: "#f0fdf4", border: "#22c55e", text: "#166534" };
}

const ENTITY_ICONS: Record<string, string> = {
  FINDING: "🔍", INCIDENT: "🚨", NC: "❌", RISK: "⚠️", CAPA: "✅",
  AUDIT: "📋", ASSET: "🖥️", CERTIFICATION: "🛡️", CHANGE: "🔄",
};

const ENTITY_PATHS: Record<string, string> = {
  FINDING: "/audits", INCIDENT: "/incidents", NC: "/nonconformities",
  RISK: "/risks", CAPA: "/capas", AUDIT: "/audits", ASSET: "/assets",
  CERTIFICATION: "/certifications", CHANGE: "/changes",
};

export default async function DashboardPage() {
  const [s, e] = await Promise.all([
    getSummary(),
    getEnhancedDashboard().catch(() => null) as Promise<DashboardEnhanced | null>,
  ]);

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
        <a
          href="/api/report"
          className="btn btn-secondary"
          style={{ padding: "6px 14px", fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          ↓ Download PDF Report
        </a>
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
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Open Risks</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#111", marginTop: 4 }}>{s.openRisks}</div>
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>{s.pendingRisks} pending review</div>
          </div>
        </Link>
        <Link href="/incidents" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "16px", borderLeft: "4px solid #f59e0b", cursor: "pointer" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Open Incidents</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#111", marginTop: 4 }}>{s.openIncidents}</div>
            <div style={{ fontSize: 12, color: s.criticalIncidents > 0 ? "#ef4444" : "#4b5563", fontWeight: s.criticalIncidents > 0 ? 600 : 400, marginTop: 2 }}>
              {s.criticalIncidents > 0 ? `${s.criticalIncidents} critical` : "No critical"}
            </div>
          </div>
        </Link>
        <Link href="/nonconformities" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "16px", borderLeft: "4px solid #8b5cf6", cursor: "pointer" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Open NCs</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#111", marginTop: 4 }}>{s.openNCs}</div>
            <div style={{ fontSize: 12, color: s.overdueNCs > 0 ? "#ef4444" : "#4b5563", fontWeight: s.overdueNCs > 0 ? 600 : 400, marginTop: 2 }}>
              {s.overdueNCs > 0 ? `${s.overdueNCs} overdue` : "None overdue"}
            </div>
          </div>
        </Link>
        <Link href="/capas" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "16px", borderLeft: "4px solid #3b82f6", cursor: "pointer" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Open CAPAs</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#111", marginTop: 4 }}>{s.openCAPAs}</div>
            <div style={{ fontSize: 12, color: s.overdueCAPAs > 0 ? "#ef4444" : "#4b5563", fontWeight: s.overdueCAPAs > 0 ? 600 : 400, marginTop: 2 }}>
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
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Active Audits</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#111", marginTop: 2 }}>{s.activeAudits}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.openFindings > 0 ? "#f59e0b" : "#22c55e" }}>{s.openFindings}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>open findings</div>
              </div>
            </div>
          </div>
        </Link>
        <Link href="/certifications" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "14px 16px", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Certifications</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#111", marginTop: 2 }}>{s.totalCerts}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.expiringSoon > 0 ? "#f59e0b" : "#22c55e" }}>{s.expiringSoon}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>expiring soon</div>
              </div>
            </div>
          </div>
        </Link>
        <Link href="/assets" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "14px 16px", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Assets</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#111", marginTop: 2 }}>{s.totalAssets}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.criticalAssets > 0 ? "#f59e0b" : "#22c55e" }}>{s.criticalAssets}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>L3-L4 critical</div>
              </div>
            </div>
          </div>
        </Link>
        <Link href="/approvals" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "14px 16px", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Changes</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#111", marginTop: 2 }}>{s.activeChanges}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.pendingChanges > 0 ? "#f59e0b" : "#22c55e" }}>{s.pendingChanges}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>pending approval</div>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* ===== Phase E: KPIs + KRIs ===== */}
      {e && (
        <>
          {/* KPI Gauges — 2 rows of 3 */}
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 12 }}>Key Performance Indicators</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {/* MTTR */}
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 8 }}>
                Mean Time to Resolve
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: e.kpis.mttr !== null ? (e.kpis.mttr <= 7 ? "#22c55e" : e.kpis.mttr <= 14 ? "#f59e0b" : "#ef4444") : "#6b7280" }}>
                {e.kpis.mttr !== null ? `${e.kpis.mttr}d` : "—"}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Incidents · last 90 days</div>
            </div>

            {/* CAPA Effectiveness */}
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 8 }}>
                CAPA Effectiveness
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: rateColor(e.kpis.capaEffectivenessRate) }}>
                {e.kpis.capaEffectivenessRate !== null ? `${e.kpis.capaEffectivenessRate}%` : "—"}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                {e.kpis.capaEffective} of {e.kpis.capaTotal} verified effective
              </div>
            </div>

            {/* Total Overdue */}
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 8 }}>
                Overdue Items
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: e.kpis.totalOverdue > 0 ? "#ef4444" : "#22c55e" }}>
                {e.kpis.totalOverdue}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                {e.kpis.overdueNCs} NCs · {e.kpis.overdueCAPAs} CAPAs · {e.kpis.overdueRisks} risks · {e.kpis.overdueFindings} findings
              </div>
            </div>

            {/* Risk Treatment */}
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 8 }}>
                Risk Treatment Rate
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: rateColor(e.kpis.riskTreatmentRate) }}>
                {e.kpis.riskTreatmentRate !== null ? `${e.kpis.riskTreatmentRate}%` : "—"}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                {e.kpis.riskTreated} of {e.kpis.riskTotal} treated/closed
              </div>
              {e.kpis.riskTreatmentRate !== null && (
                <div style={{ marginTop: 6, height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${e.kpis.riskTreatmentRate}%`, background: rateColor(e.kpis.riskTreatmentRate), borderRadius: 2 }} />
                </div>
              )}
            </div>

            {/* Audit Completion */}
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 8 }}>
                Audit Completion
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: rateColor(e.kpis.auditCompletionRate) }}>
                {e.kpis.auditCompletionRate !== null ? `${e.kpis.auditCompletionRate}%` : "—"}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                {e.kpis.auditCompleted} of {e.kpis.auditTotal} this year
              </div>
              {e.kpis.auditCompletionRate !== null && (
                <div style={{ marginTop: 6, height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${e.kpis.auditCompletionRate}%`, background: rateColor(e.kpis.auditCompletionRate), borderRadius: 2 }} />
                </div>
              )}
            </div>

            {/* NC Closure Rate */}
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 8 }}>
                NC Closure Rate
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: rateColor(e.kpis.ncClosureRate) }}>
                {e.kpis.ncClosureRate !== null ? `${e.kpis.ncClosureRate}%` : "—"}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                {e.kpis.ncClosed} of {e.kpis.ncTotal} closed (last 180 days)
              </div>
              {e.kpis.ncClosureRate !== null && (
                <div style={{ marginTop: 6, height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${e.kpis.ncClosureRate}%`, background: rateColor(e.kpis.ncClosureRate), borderRadius: 2 }} />
                </div>
              )}
            </div>
          </div>

          {/* KRI Banner Cards */}
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 12 }}>Key Risk Indicators</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "High/Critical Risks", value: e.kris.highRisks, thresholds: [3, 5], unit: "", link: "/risks" },
              { label: "Critical Incidents (30d)", value: e.kris.recentCriticalIncidents, thresholds: [1, 3], unit: "", link: "/incidents" },
              { label: "Expired Certifications", value: e.kris.expiredCerts, thresholds: [1, 2], unit: "", link: "/certifications" },
              { label: "Weak Controls", value: e.kris.weakControls, thresholds: [2, 4], unit: " risks", link: "/risks" },
            ].map((kri) => {
              const c = kriColor(kri.value, kri.thresholds[0], kri.thresholds[1]);
              return (
                <Link key={kri.label} href={kri.link} style={{ textDecoration: "none" }}>
                  <div className="card" style={{ padding: "14px 16px", background: c.bg, border: `1px solid ${c.border}`, cursor: "pointer" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: c.text, opacity: 0.7, marginBottom: 6 }}>
                      {kri.label}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: c.text }}>
                      {kri.value}{kri.unit}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* 6-Month Trends */}
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 12 }}>6-Month Trends</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {(["incidents", "risks", "ncs", "capas"] as const).map((key) => {
              const labels: Record<string, string> = { incidents: "Incidents", risks: "Risks Opened", ncs: "Non-Conformities", capas: "CAPAs Opened" };
              const colors: Record<string, string> = { incidents: "#ef4444", risks: "#f59e0b", ncs: "#8b5cf6", capas: "#3b82f6" };
              const data = e.trends[key];
              const maxCount = Math.max(...data.map((d) => d.count), 1);

              return (
                <div key={key} className="card" style={{ padding: "16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 12 }}>{labels[key]}</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
                    {data.map((d) => (
                      <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#111" }}>{d.count > 0 ? d.count : ""}</div>
                        <div style={{
                          width: "100%", minHeight: 4,
                          height: `${(d.count / maxCount) * 60}px`,
                          background: colors[key], borderRadius: 3, opacity: d.count > 0 ? 1 : 0.15,
                        }} />
                        <div style={{ fontSize: 9, color: "#6b7280" }}>{d.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cross-Register Links (recent) */}
          {e.recentLinks && e.recentLinks.length > 0 && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 12 }}>Recent Cross-Register Links</div>
              <div className="table-card" style={{ marginBottom: 20 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th></th>
                      <th>Target</th>
                      <th>Type</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.recentLinks.map((link: any) => (
                      <tr key={link.id}>
                        <td>
                          <Link href={`${ENTITY_PATHS[link.source_type]}/${link.source_id}`} style={{ textDecoration: "none", color: "#111", fontWeight: 550 }}>
                            {ENTITY_ICONS[link.source_type]} {link.source_title || link.source_type}
                          </Link>
                        </td>
                        <td style={{ textAlign: "center", color: "#6b7280", fontSize: 14 }}>→</td>
                        <td>
                          <Link href={`${ENTITY_PATHS[link.target_type]}/${link.target_id}`} style={{ textDecoration: "none", color: "#111", fontWeight: 550 }}>
                            {ENTITY_ICONS[link.target_type]} {link.target_title || link.target_type}
                          </Link>
                        </td>
                        <td>
                          <span className={`badge badge-${link.link_type === "GENERATED" ? "internal" : "external"}`}>{link.link_type}</span>
                        </td>
                        <td style={{ fontSize: 12, color: "#6b7280" }}>{new Date(link.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Risk Distribution — Full Width (existing) */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
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
              <div style={{ width: 60, fontSize: 12, fontWeight: 600, color: "#4b5563" }}>{r.label}</div>
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
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Top Risks</div>
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

      {/* Recent Activity */}
      {e && e.recentActivity && e.recentActivity.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>Recent Activity</div>
            <Link href="/activity" style={{ fontSize: 12, color: "#6366f1", textDecoration: "none" }}>View all →</Link>
          </div>
          {e.recentActivity.map((a: any) => (
            <div key={a.id} style={{
              padding: "10px 0", borderBottom: "1px solid #f3f4f6",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>
                  {ENTITY_ICONS[a.entity_type] || "📌"} {a.action}
                </span>
                {a.meta?.name && (
                  <span style={{ fontSize: 12, color: "#4b5563", marginLeft: 6 }}>
                    — {a.meta.name}
                  </span>
                )}
                <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
                  by {a.full_name || a.email || "System"}
                </span>
              </div>
              <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                {new Date(a.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

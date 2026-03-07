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
function rateColor(rate: number | null) {
  if (rate === null) return "#6b7280";
  if (rate >= 80) return "#22c55e";
  if (rate >= 60) return "#f59e0b";
  return "#ef4444";
}
function kriColor(value: number, ta: number, tr: number) {
  if (value >= tr) return { bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" };
  if (value >= ta) return { bg: "#fffbeb", text: "#92400e", dot: "#f59e0b" };
  return { bg: "#f0fdf4", text: "#166534", dot: "#22c55e" };
}
const ENTITY_ICONS: Record<string, string> = { FINDING: "🔍", INCIDENT: "🚨", NC: "❌", RISK: "⚠️", CAPA: "✅", AUDIT: "📋", ASSET: "🖥️", CERTIFICATION: "🛡️", CHANGE: "🔄" };
const ENTITY_PATHS: Record<string, string> = { FINDING: "/audits", INCIDENT: "/incidents", NC: "/nonconformities", RISK: "/risks", CAPA: "/capas", AUDIT: "/audits", ASSET: "/assets", CERTIFICATION: "/certifications", CHANGE: "/changes" };
const card = { background: "#fff", borderRadius: 12, border: "1px solid #d8dce3", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" } as const;
function SectionLabel({ children }: { children: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>{children}</div>;
}
function Gauge({ value, label, sub, link }: { value: number | null; label: string; sub: string; link: string }) {
  const pct = value ?? 0; const c = rateColor(value); const circ = 2 * Math.PI * 34; const offset = circ - (pct / 100) * circ;
  return (
    <Link href={link} style={{ textDecoration: "none" }}>
      <div style={{ ...card, padding: "20px 12px", textAlign: "center", cursor: "pointer" }}>
        <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 10px" }}>
          <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="40" cy="40" r="34" fill="none" stroke="#eef0f4" strokeWidth="5" />
            <circle cx="40" cy="40" r="34" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={value !== null ? offset : circ} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: value !== null ? c : "#9ca3af" }}>{value !== null ? `${value}%` : "—"}</span>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#111" }}>{label}</div>
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{sub}</div>
      </div>
    </Link>
  );
}
export default async function DashboardPage() {
  let s: any; let e: DashboardEnhanced | null = null;
  try { [s, e] = await Promise.all([getSummary(), getEnhancedDashboard().catch(() => null) as Promise<DashboardEnhanced | null>]); } catch (err: any) { throw new Error(`Dashboard load failed: ${err.message}`); }
  const alerts: { level: "red" | "amber" | "blue"; message: string; link: string }[] = [];
  if (s.criticalIncidents > 0) alerts.push({ level: "red", message: `${s.criticalIncidents} critical incident${s.criticalIncidents > 1 ? "s" : ""} unresolved`, link: "/incidents" });
  if (s.overdueNCs > 0) alerts.push({ level: "red", message: `${s.overdueNCs} non-conformit${s.overdueNCs > 1 ? "ies" : "y"} overdue`, link: "/nonconformities" });
  if (s.overdueCAPAs > 0) alerts.push({ level: "red", message: `${s.overdueCAPAs} CAPA${s.overdueCAPAs > 1 ? "s" : ""} past due date`, link: "/capas" });
  if (s.ineffectiveCAPAs > 0) alerts.push({ level: "red", message: `${s.ineffectiveCAPAs} CAPA${s.ineffectiveCAPAs > 1 ? "s" : ""} verified as ineffective`, link: "/capas" });
  if (s.expiringSoon > 0) alerts.push({ level: "amber", message: `${s.expiringSoon} certification${s.expiringSoon > 1 ? "s" : ""} expiring within 60 days`, link: "/certifications" });
  if (s.pendingRisks > 0) alerts.push({ level: "amber", message: `${s.pendingRisks} risk${s.pendingRisks > 1 ? "s" : ""} pending review`, link: "/risks" });
  if (s.pendingChanges > 0) alerts.push({ level: "blue", message: `${s.pendingChanges} change request${s.pendingChanges > 1 ? "s" : ""} awaiting approval`, link: "/approvals" });
  const alertS = { red: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", icon: "🚨" }, amber: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", icon: "⚠️" }, blue: { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", icon: "ℹ️" } };
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.02em" }}>Compliance Dashboard</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Real-time compliance posture across all registers</p>
        </div>
        <a href="/api/report" style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, background: "#111", color: "#fff", borderRadius: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          PDF Report
        </a>
      </div>
      {alerts.length > 0 && (<div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>{alerts.map((a, i) => { const c = alertS[a.level]; return (<Link key={i} href={a.link} style={{ textDecoration: "none" }}><div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 16px", fontSize: 13, color: c.text, display: "flex", alignItems: "center", justifyContent: "space-between" }}><span>{c.icon} {a.message}</span><span style={{ fontSize: 11, opacity: 0.6 }}>View →</span></div></Link>); })}</div>)}
      <SectionLabel>Register Overview</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        {[{ label: "Open Risks", value: s.openRisks, sub: `${s.pendingRisks} pending review`, accent: "#ef4444", link: "/risks", alert: false },
          { label: "Open Incidents", value: s.openIncidents, sub: s.criticalIncidents > 0 ? `${s.criticalIncidents} critical` : "No critical", accent: "#f59e0b", link: "/incidents", alert: s.criticalIncidents > 0 },
          { label: "Open NCs", value: s.openNCs, sub: s.overdueNCs > 0 ? `${s.overdueNCs} overdue` : "None overdue", accent: "#8b5cf6", link: "/nonconformities", alert: s.overdueNCs > 0 },
          { label: "Open CAPAs", value: s.openCAPAs, sub: s.overdueCAPAs > 0 ? `${s.overdueCAPAs} overdue` : "On track", accent: "#3b82f6", link: "/capas", alert: s.overdueCAPAs > 0 },
        ].map((kpi) => (<Link key={kpi.label} href={kpi.link} style={{ textDecoration: "none" }}><div style={{ ...card, padding: "18px 20px", borderLeft: `4px solid ${kpi.accent}`, cursor: "pointer" }}><div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>{kpi.label}</div><div style={{ fontSize: 32, fontWeight: 700, color: "#111", marginTop: 4, lineHeight: 1 }}>{kpi.value}</div><div style={{ fontSize: 12, color: kpi.alert ? "#ef4444" : "#6b7280", fontWeight: kpi.alert ? 600 : 400, marginTop: 6 }}>{kpi.sub}</div></div></Link>))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[{ label: "Active Audits", value: s.activeAudits, right: s.openFindings, rl: "open findings", warn: s.openFindings > 0, link: "/audits" },
          { label: "Certifications", value: s.totalCerts, right: s.expiringSoon, rl: "expiring soon", warn: s.expiringSoon > 0, link: "/certifications" },
          { label: "Assets", value: s.totalAssets, right: s.criticalAssets, rl: "L3–L4 critical", warn: s.criticalAssets > 0, link: "/assets" },
          { label: "Changes", value: s.activeChanges, right: s.pendingChanges, rl: "pending approval", warn: s.pendingChanges > 0, link: "/approvals" },
        ].map((item) => (<Link key={item.label} href={item.link} style={{ textDecoration: "none" }}><div style={{ ...card, padding: "16px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>{item.label}</div><div style={{ fontSize: 24, fontWeight: 700, color: "#111", marginTop: 2 }}>{item.value}</div></div><div style={{ textAlign: "right" }}><div style={{ fontSize: 20, fontWeight: 700, color: item.warn ? "#f59e0b" : "#22c55e" }}>{item.right}</div><div style={{ fontSize: 10, color: "#9ca3af" }}>{item.rl}</div></div></div></Link>))}
      </div>
      {e && (<>
        <SectionLabel>Performance Metrics</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
          <Link href="/incidents" style={{ textDecoration: "none" }}><div style={{ ...card, padding: "20px 12px", textAlign: "center", cursor: "pointer" }}><div style={{ fontSize: 32, fontWeight: 700, color: e.kpis.mttr !== null ? (e.kpis.mttr <= 7 ? "#22c55e" : e.kpis.mttr <= 14 ? "#f59e0b" : "#ef4444") : "#9ca3af", marginBottom: 6 }}>{e.kpis.mttr !== null ? `${e.kpis.mttr}d` : "—"}</div><div style={{ fontSize: 11, fontWeight: 600, color: "#111" }}>Mean Time to Resolve</div><div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>Incidents · 90 days</div></div></Link>
          <Gauge value={e.kpis.riskTreatmentRate} label="Risk Treatment" sub={`${e.kpis.riskTreated}/${e.kpis.riskTotal} treated`} link="/risks" />
          <Gauge value={e.kpis.auditCompletionRate} label="Audit Completion" sub={`${e.kpis.auditCompleted}/${e.kpis.auditTotal} this year`} link="/audits" />
          <Gauge value={e.kpis.ncClosureRate} label="NC Closure" sub={`${e.kpis.ncClosed}/${e.kpis.ncTotal} (180d)`} link="/nonconformities" />
          <Gauge value={e.kpis.capaEffectivenessRate} label="CAPA Effectiveness" sub={`${e.kpis.capaEffective}/${e.kpis.capaTotal} effective`} link="/capas" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
          <div style={{ ...card, padding: 20 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Overdue Items</div><div style={{ fontSize: 26, fontWeight: 700, color: e.kpis.totalOverdue > 0 ? "#ef4444" : "#22c55e" }}>{e.kpis.totalOverdue}</div></div>
            {[{ label: "Non-Conformities", value: e.kpis.overdueNCs, link: "/nonconformities" },{ label: "CAPAs", value: e.kpis.overdueCAPAs, link: "/capas" },{ label: "Risks", value: e.kpis.overdueRisks, link: "/risks" },{ label: "Findings", value: e.kpis.overdueFindings, link: "/audits" }].map((item) => (<Link key={item.label} href={item.link} style={{ textDecoration: "none" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #f3f4f6" }}><span style={{ fontSize: 13, color: "#374151" }}>{item.label}</span><span style={{ fontSize: 13, fontWeight: 700, color: item.value > 0 ? "#ef4444" : "#22c55e", background: item.value > 0 ? "#fef2f2" : "#f0fdf4", padding: "2px 10px", borderRadius: 6, minWidth: 28, textAlign: "center" }}>{item.value}</span></div></Link>))}
          </div>
          <div style={{ ...card, padding: 20 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Key Risk Indicators</div>
            {[{ label: "High/Critical Risks", value: e.kris.highRisks, t: [3, 5], link: "/risks" },{ label: "Critical Incidents (30d)", value: e.kris.recentCriticalIncidents, t: [1, 3], link: "/incidents" },{ label: "Expired Certifications", value: e.kris.expiredCerts, t: [1, 2], link: "/certifications" },{ label: "Weak Controls", value: e.kris.weakControls, t: [2, 4], link: "/risks" }].map((kri) => { const c = kriColor(kri.value, kri.t[0], kri.t[1]); return (<Link key={kri.label} href={kri.link} style={{ textDecoration: "none" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #f3f4f6" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot, flexShrink: 0 }} /><span style={{ fontSize: 13, color: "#374151" }}>{kri.label}</span></div><span style={{ fontSize: 13, fontWeight: 700, color: c.text, background: c.bg, padding: "2px 10px", borderRadius: 6, minWidth: 28, textAlign: "center" }}>{kri.value}</span></div></Link>); })}
          </div>
        </div>
        <SectionLabel>6-Month Trends</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
          {(["incidents", "risks", "ncs", "capas"] as const).map((key) => { const labels: Record<string, string> = { incidents: "Incidents", risks: "Risks Opened", ncs: "Non-Conformities", capas: "CAPAs Opened" }; const colors: Record<string, string> = { incidents: "#ef4444", risks: "#f59e0b", ncs: "#8b5cf6", capas: "#3b82f6" }; const data = e.trends[key]; const maxC = Math.max(...data.map((d) => d.count), 1); return (
            <div key={key} style={{ ...card, padding: "18px 20px" }}><div style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 14 }}>{labels[key]}</div><div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 72 }}>{data.map((d) => (<div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#111" }}>{d.count > 0 ? d.count : ""}</div><div style={{ width: "100%", minHeight: 4, borderRadius: 4, height: `${Math.max((d.count / maxC) * 56, 4)}px`, background: d.count > 0 ? colors[key] : "#dde0e6", opacity: d.count > 0 ? 1 : 0.5 }} /><div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 500 }}>{d.label}</div></div>))}</div></div>); })}
        </div>
        {e.recentLinks && e.recentLinks.length > 0 && (<><SectionLabel>Recent Cross-Register Links</SectionLabel><div style={{ ...card, overflow: "hidden", marginBottom: 24, padding: 0 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr style={{ borderBottom: "1px solid #d8dce3", background: "#f8f9fb" }}>{["Source", "", "Target", "Type", "Date"].map((h) => (<th key={h} style={{ padding: "10px 16px", textAlign: h === "" ? "center" : "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>))}</tr></thead><tbody>{e.recentLinks.map((link: any) => (<tr key={link.id} style={{ borderBottom: "1px solid #f3f4f6" }}><td style={{ padding: "10px 16px" }}><Link href={`${ENTITY_PATHS[link.source_type]}/${link.source_id}`} style={{ textDecoration: "none", color: "#111", fontWeight: 500 }}>{ENTITY_ICONS[link.source_type]} {link.source_title || link.source_type}</Link></td><td style={{ textAlign: "center", color: "#9ca3af" }}>→</td><td style={{ padding: "10px 16px" }}><Link href={`${ENTITY_PATHS[link.target_type]}/${link.target_id}`} style={{ textDecoration: "none", color: "#111", fontWeight: 500 }}>{ENTITY_ICONS[link.target_type]} {link.target_title || link.target_type}</Link></td><td style={{ padding: "10px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(99,102,241,0.08)", color: "#6366f1" }}>{link.link_type}</span></td><td style={{ padding: "10px 16px", fontSize: 12, color: "#6b7280" }}>{new Date(link.created_at).toLocaleDateString()}</td></tr>))}</tbody></table></div></>)}
      </>)}
      <SectionLabel>Risk Analysis</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <div style={{ ...card, padding: 20 }}><div style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 16 }}>Distribution by Level</div>
          {[{ label: "Critical", count: s.risksByLevel?.critical ?? 0, color: "#ef4444" },{ label: "High", count: s.risksByLevel?.high ?? 0, color: "#f59e0b" },{ label: "Medium", count: s.risksByLevel?.medium ?? 0, color: "#eab308" },{ label: "Low", count: s.risksByLevel?.low ?? 0, color: "#22c55e" }].map((r) => { const maxC = Math.max(s.risksByLevel?.critical ?? 0, s.risksByLevel?.high ?? 0, s.risksByLevel?.medium ?? 0, s.risksByLevel?.low ?? 0, 1); return (<div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}><div style={{ width: 56, fontSize: 12, fontWeight: 600, color: "#374151" }}>{r.label}</div><div style={{ flex: 1, height: 22, background: "#eef0f4", borderRadius: 6, overflow: "hidden" }}><div style={{ width: `${(r.count / maxC) * 100}%`, height: "100%", background: r.color, borderRadius: 6, minWidth: r.count > 0 ? 28 : 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{r.count > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{r.count}</span>}</div></div></div>); })}
        </div>
        <div style={{ ...card, padding: 20 }}><div style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 16 }}>Top Risks</div>
          {s.topRisks && s.topRisks.length > 0 ? s.topRisks.map((r: any) => (<Link key={r.id} href={`/risks/${r.id}`} style={{ textDecoration: "none" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}><span style={{ fontSize: 13, color: "#111", fontWeight: 500 }}>{r.title}</span><span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(r.inherent_score), background: `${scoreColor(r.inherent_score)}12`, padding: "2px 10px", borderRadius: 6 }}>{r.inherent_score}</span></div></Link>)) : (<div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: 20 }}>No risks recorded yet</div>)}
        </div>
      </div>
      {e && e.recentActivity && e.recentActivity.length > 0 && (<><SectionLabel>Recent Activity</SectionLabel><div style={{ ...card, padding: 20 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>Latest actions across all modules</div><Link href="/activity" style={{ fontSize: 12, color: "#6366f1", textDecoration: "none", fontWeight: 500 }}>View all →</Link></div>{e.recentActivity.map((a: any) => (<div key={a.id} style={{ padding: "9px 0", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><span style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{ENTITY_ICONS[a.entity_type] || "📌"} {a.action}</span>{a.meta?.name && <span style={{ fontSize: 12, color: "#4b5563", marginLeft: 6 }}>— {a.meta.name}</span>}<span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>by {a.full_name || a.email || "System"}</span></div><span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>{new Date(a.created_at).toLocaleString()}</span></div>))}</div></>)}
    </>
  );
}

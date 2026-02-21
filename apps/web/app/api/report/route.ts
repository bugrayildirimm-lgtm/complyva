import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE = process.env.API_BASE ?? "http://localhost:4000";

async function getAuthHeaders() {
  const { userId: clerkUserId } = await auth();
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  const syncRes = await fetch(`${API_BASE}/auth/sync`, {
    method: "POST",
    headers: {
      "x-clerk-user-id": clerkUserId!,
      "x-clerk-email": user.emailAddresses[0]?.emailAddress ?? "",
      "x-clerk-name": `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
    },
    body: "{}",
  });
  const syncData = await syncRes.json();
  if (!syncRes.ok) throw new Error("Auth failed");
  return { "x-org-id": syncData.orgId, "x-user-id": syncData.userId, "x-role": syncData.role };
}

async function apiFetch(path: string, headers: Record<string, string>) {
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) return [];
  return res.json();
}

function d(val: any): string {
  if (!val) return "—";
  return String(val).slice(0, 10);
}

function riskLevel(score: number): string {
  if (score >= 20) return "VERY HIGH";
  if (score >= 15) return "HIGH";
  if (score >= 10) return "MEDIUM";
  if (score >= 5) return "LOW";
  return "VERY LOW";
}

// Color helpers returning [r,g,b]
function statusRGB(status: string): [number, number, number] {
  const s = (status || "").toUpperCase().replace(/ /g, "_");
  const map: Record<string, [number, number, number]> = {
    OPEN: [59, 130, 246], ACTIVE: [34, 197, 94], CLOSED: [107, 114, 128], COMPLETED: [34, 197, 94],
    IN_TREATMENT: [245, 158, 11], IN_PROGRESS: [245, 158, 11], PENDING_REVIEW: [245, 158, 11],
    ACCEPTED: [34, 197, 94], REJECTED: [239, 68, 68], EXPIRED: [239, 68, 68],
    PLANNED: [139, 92, 246], RESOLVED: [34, 197, 94], INVESTIGATING: [245, 158, 11],
    VERIFIED: [34, 197, 94], DRAFT: [156, 163, 175], SUBMITTED: [59, 130, 246], APPROVED: [34, 197, 94],
  };
  return map[s] || [107, 114, 128];
}

function severityRGB(sev: string): [number, number, number] {
  const map: Record<string, [number, number, number]> = {
    CRITICAL: [153, 27, 27], HIGH: [239, 68, 68], MAJOR: [239, 68, 68],
    MEDIUM: [245, 158, 11], LOW: [34, 197, 94], MINOR: [34, 197, 94], OBSERVATION: [107, 114, 128],
  };
  return map[(sev || "").toUpperCase()] || [107, 114, 128];
}

function scoreRGB(score: number): [number, number, number] {
  if (score >= 20) return [239, 68, 68];
  if (score >= 15) return [245, 158, 11];
  if (score >= 10) return [234, 179, 8];
  if (score >= 5) return [59, 130, 246];
  return [34, 197, 94];
}

export async function GET(req: NextRequest) {
  try {
    const headers = await getAuthHeaders();

    const [risks, audits, certifications, assets, incidents, changes, ncs, capas] = await Promise.all([
      apiFetch("/risks", headers),
      apiFetch("/audits", headers),
      apiFetch("/certifications", headers),
      apiFetch("/assets", headers),
      apiFetch("/incidents", headers),
      apiFetch("/changes", headers),
      apiFetch("/nonconformities", headers),
      apiFetch("/capas", headers),
    ]);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);

    // Stats
    const openRisks = risks.filter((r: any) => !["CLOSED", "REJECTED"].includes(r.status)).length;
    const criticalRisks = risks.filter((r: any) => r.inherent_score >= 20 && !["CLOSED", "REJECTED"].includes(r.status)).length;
    const openIncidents = incidents.filter((i: any) => !["RESOLVED", "CLOSED"].includes(i.status)).length;
    const openNCs = ncs.filter((n: any) => !["CLOSED", "VERIFIED"].includes(n.status)).length;
    const openCAPAs = capas.filter((c: any) => !["CLOSED", "VERIFIED"].includes(c.status)).length;
    const activeCerts = certifications.filter((c: any) => c.status === "ACTIVE").length;
    const expiredCerts = certifications.filter((c: any) => c.status === "EXPIRED" || (c.expiry_date && new Date(c.expiry_date) < now)).length;
    const activeAudits = audits.filter((a: any) => ["PLANNED", "IN_PROGRESS"].includes(a.status)).length;
    const pendingChanges = changes.filter((c: any) => ["DRAFT", "SUBMITTED", "APPROVED"].includes(c.status)).length;

    // Risk distribution
    const riskDist = { critical: 0, high: 0, medium: 0, low: 0, veryLow: 0 };
    risks.filter((r: any) => !["CLOSED", "REJECTED"].includes(r.status)).forEach((r: any) => {
      if (r.inherent_score >= 20) riskDist.critical++;
      else if (r.inherent_score >= 15) riskDist.high++;
      else if (r.inherent_score >= 10) riskDist.medium++;
      else if (r.inherent_score >= 5) riskDist.low++;
      else riskDist.veryLow++;
    });

    // --- Build PDF ---
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const marginL = 15;
    const marginR = 15;
    const contentW = pageW - marginL - marginR;
    let y = 0;

    // Helper: add header/footer to all pages at the end
    const addHeaderFooter = () => {
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        if (i > 1) {
          doc.setFontSize(7);
          doc.setTextColor(156, 163, 175);
          doc.text("Complyva Compliance Report", marginL, 8);
          doc.text(dateStr, pageW - marginR, 8, { align: "right" });
        }
        doc.setFontSize(7);
        doc.setTextColor(156, 163, 175);
        doc.text(`Page ${i} of ${pageCount}`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
      }
    };

    // --- PAGE 1: Title + Summary ---
    y = 50;
    doc.setFontSize(28);
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "bold");
    doc.text("COMPLIANCE REPORT", marginL, y);

    y += 12;
    doc.setFontSize(12);
    doc.setTextColor(107, 114, 128);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated ${dateStr}`, marginL, y);

    y += 8;
    doc.setDrawColor(31, 41, 55);
    doc.setLineWidth(0.5);
    doc.line(marginL, y, pageW - marginR, y);

    // KPI boxes
    y += 15;
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "bold");
    doc.text("Executive Summary", marginL, y);

    y += 10;
    const boxW = contentW / 4 - 3;
    const kpis = [
      { label: "Open Risks", value: openRisks, color: openRisks > 0 ? [239, 68, 68] : [34, 197, 94] },
      { label: "Open Incidents", value: openIncidents, color: openIncidents > 0 ? [245, 158, 11] : [34, 197, 94] },
      { label: "Open NCs", value: openNCs, color: openNCs > 0 ? [245, 158, 11] : [34, 197, 94] },
      { label: "Open CAPAs", value: openCAPAs, color: openCAPAs > 0 ? [245, 158, 11] : [34, 197, 94] },
    ];

    kpis.forEach((kpi, i) => {
      const x = marginL + i * (boxW + 4);
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(x, y, boxW, 24, 2, 2, "F");
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.setFont("helvetica", "normal");
      doc.text(kpi.label, x + boxW / 2, y + 8, { align: "center" });
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.text(String(kpi.value), x + boxW / 2, y + 20, { align: "center" });
    });

    y += 32;
    const kpis2 = [
      { label: "Active Audits", value: String(activeAudits) },
      { label: "Certifications", value: `${activeCerts} / ${expiredCerts} exp` },
      { label: "Assets", value: String(assets.length) },
      { label: "Pending Changes", value: String(pendingChanges) },
    ];

    kpis2.forEach((kpi, i) => {
      const x = marginL + i * (boxW + 4);
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(x, y, boxW, 24, 2, 2, "F");
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.setFont("helvetica", "normal");
      doc.text(kpi.label, x + boxW / 2, y + 8, { align: "center" });
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text(kpi.value, x + boxW / 2, y + 20, { align: "center" });
    });

    // Risk distribution
    y += 35;
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "bold");
    doc.text("Risk Distribution (Active)", marginL, y);

    y += 8;
    const distItems = [
      { label: "Critical", count: riskDist.critical, color: [239, 68, 68] as [number, number, number], bg: [254, 242, 242] as [number, number, number] },
      { label: "High", count: riskDist.high, color: [249, 115, 22] as [number, number, number], bg: [255, 247, 237] as [number, number, number] },
      { label: "Medium", count: riskDist.medium, color: [245, 158, 11] as [number, number, number], bg: [255, 251, 235] as [number, number, number] },
      { label: "Low", count: riskDist.low, color: [59, 130, 246] as [number, number, number], bg: [239, 246, 255] as [number, number, number] },
      { label: "Very Low", count: riskDist.veryLow, color: [34, 197, 94] as [number, number, number], bg: [240, 253, 244] as [number, number, number] },
    ];

    const distBoxW = contentW / 5 - 2;
    distItems.forEach((item, i) => {
      const x = marginL + i * (distBoxW + 2.5);
      doc.setFillColor(item.bg[0], item.bg[1], item.bg[2]);
      doc.roundedRect(x, y, distBoxW, 18, 2, 2, "F");
      doc.setFontSize(7);
      doc.setTextColor(item.color[0], item.color[1], item.color[2]);
      doc.setFont("helvetica", "normal");
      doc.text(item.label, x + distBoxW / 2, y + 7, { align: "center" });
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(String(item.count), x + distBoxW / 2, y + 15, { align: "center" });
    });

    // --- REGISTER TABLES ---

    // Helper for section
    const addSection = (title: string, subtitle: string, head: string[][], body: string[][], columnStyles?: any) => {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(31, 41, 55);
      doc.setFont("helvetica", "bold");
      doc.text(title, marginL, 20);
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.setFont("helvetica", "normal");
      doc.text(subtitle, marginL, 27);

      if (body.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(156, 163, 175);
        doc.setFont("helvetica", "italic");
        doc.text(`No ${title.toLowerCase()} recorded.`, marginL, 38);
        return;
      }

      autoTable(doc, {
        startY: 32,
        head,
        body,
        margin: { left: marginL, right: marginR },
        styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: columnStyles || {},
        didParseCell: (data: any) => {
          // Color status columns
          if (data.section === "body" && data.column.index === head[0].length - 1) {
            // Last column is usually status
          }
        },
      });
    };

    // RISKS
    addSection(
      "Risk Register",
      `${risks.length} total · ${openRisks} open`,
      [["Title", "Category", "L", "I", "Score", "Level", "Status"]],
      risks.map((r: any) => [
        r.title, r.category || "—", String(r.likelihood), String(r.impact),
        String(r.inherent_score), riskLevel(r.inherent_score), (r.status || "").replace(/_/g, " "),
      ]),
    );

    // INCIDENTS
    addSection(
      "Incidents",
      `${incidents.length} total · ${openIncidents} open`,
      [["Title", "Severity", "Category", "Status", "Incident Date", "Resolved"]],
      incidents.map((i: any) => [
        i.title, i.severity || "—", i.category || "—", (i.status || "").replace(/_/g, " "),
        d(i.incident_date), d(i.resolved_date),
      ]),
    );

    // NON-CONFORMITIES
    addSection(
      "Non-Conformities",
      `${ncs.length} total · ${openNCs} open`,
      [["Title", "Severity", "Source", "Status", "Due Date", "Closed"]],
      ncs.map((n: any) => [
        n.title, n.severity || "—", n.source_type || "—", (n.status || "").replace(/_/g, " "),
        d(n.due_date), d(n.closed_date),
      ]),
    );

    // CAPAs
    addSection(
      "CAPAs",
      `${capas.length} total · ${openCAPAs} open`,
      [["Title", "Type", "Priority", "Status", "Due Date", "Completed"]],
      capas.map((c: any) => [
        c.title, c.capa_type || "—", c.priority || "—", (c.status || "").replace(/_/g, " "),
        d(c.due_date), d(c.completed_date),
      ]),
    );

    // AUDITS
    addSection(
      "Audits",
      `${audits.length} total · ${activeAudits} active`,
      [["Title", "Type", "Auditor", "Status", "Start Date"]],
      audits.map((a: any) => [
        a.title, a.type || "—", a.auditor || "—", (a.status || "").replace(/_/g, " "), d(a.start_date),
      ]),
    );

    // CERTIFICATIONS
    addSection(
      "Certifications",
      `${certifications.length} total · ${activeCerts} active · ${expiredCerts} expired`,
      [["Name", "Framework", "Issuing Body", "Status", "Issue Date", "Expiry"]],
      certifications.map((c: any) => [
        c.name, c.framework_type || "—", c.issuing_body || "—", c.status || "—",
        d(c.issue_date), d(c.expiry_date),
      ]),
    );

    // ASSETS
    addSection(
      "Asset Register",
      `${assets.length} total`,
      [["Name", "Type", "Category", "Owner", "Classification", "Status"]],
      assets.map((a: any) => [
        a.name, a.asset_type || "—", a.category || "—", a.owner || "—",
        a.combined_classification != null ? String(a.combined_classification) : "—", a.status || "—",
      ]),
    );

    // CHANGES
    addSection(
      "Change Requests",
      `${changes.length} total · ${pendingChanges} pending`,
      [["Title", "Type", "Priority", "Status", "Planned Start", "Planned End"]],
      changes.map((c: any) => [
        c.title, c.change_type || "—", c.priority || "—", (c.status || "").replace(/_/g, " "),
        d(c.planned_start), d(c.planned_end),
      ]),
    );

    // Add header/footer to all pages
    addHeaderFooter();

    // Output
    const buffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="compliance_report_${dateStr}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

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

  return {
    "x-org-id": syncData.orgId,
    "x-user-id": syncData.userId,
    "x-role": syncData.role,
  };
}

// --- Styling constants ---
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Arial" };
const DATA_FONT: Partial<ExcelJS.Font> = { size: 10, name: "Arial" };
const BORDER_THIN: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFE5E7EB" } };
const CELL_BORDER: Partial<ExcelJS.Borders> = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "FF22C55E", OPEN: "FF3B82F6", "IN PROGRESS": "FFF59E0B", "IN_PROGRESS": "FFF59E0B",
  "IN TREATMENT": "FFF59E0B", "IN_TREATMENT": "FFF59E0B",
  PLANNED: "FF8B5CF6", COMPLETED: "FF22C55E", CLOSED: "FF6B7280", CANCELLED: "FF9CA3AF",
  "PENDING REVIEW": "FFF59E0B", "PENDING_REVIEW": "FFF59E0B",
  ACCEPTED: "FF22C55E", REJECTED: "FFEF4444",
  EXPIRED: "FFEF4444", REVOKED: "FFEF4444", SUSPENDED: "FFF59E0B",
  DRAFT: "FF9CA3AF", SUBMITTED: "FF3B82F6", APPROVED: "FF22C55E",
  INVESTIGATING: "FFF59E0B", CONTAINED: "FF8B5CF6", RESOLVED: "FF22C55E",
  VERIFIED: "FF22C55E",
};

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "FF22C55E", MINOR: "FF22C55E", MEDIUM: "FFF59E0B",
  HIGH: "FFEF4444", MAJOR: "FFEF4444", CRITICAL: "FF991B1B",
  OBSERVATION: "FF6B7280",
};

function applyColorFill(cell: ExcelJS.Cell, map: Record<string, string>, value: string) {
  const key = String(value ?? "").toUpperCase().replace(/ /g, "_");
  const keySpace = String(value ?? "").toUpperCase();
  const color = map[key] || map[keySpace];
  if (color) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    cell.font = { ...DATA_FONT, color: { argb: "FFFFFFFF" }, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
}

function applyScoreFill(cell: ExcelJS.Cell, score: number) {
  let color = "FF22C55E";
  if (score >= 20) color = "FFEF4444";
  else if (score >= 15) color = "FFF59E0B";
  else if (score >= 10) color = "FFEAB308";
  else if (score >= 5) color = "FF3B82F6";
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  cell.font = { ...DATA_FONT, color: { argb: "FFFFFFFF" }, bold: true };
  cell.alignment = { horizontal: "center" };
}

function setupSheet(ws: ExcelJS.Worksheet, columns: { header: string; key: string; width: number }[]) {
  ws.columns = columns;
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = CELL_BORDER;
  });
  headerRow.height = 28;
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

function styleDataRows(ws: ExcelJS.Worksheet, opts: { statusCol?: string; severityCol?: string; scoreCol?: string }) {
  const colKeys = ws.columns.map((c) => c.key);
  const statusIdx = opts.statusCol ? colKeys.indexOf(opts.statusCol) + 1 : 0;
  const sevIdx = opts.severityCol ? colKeys.indexOf(opts.severityCol) + 1 : 0;
  const scoreIdx = opts.scoreCol ? colKeys.indexOf(opts.scoreCol) + 1 : 0;

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const isEven = rowNum % 2 === 0;
    row.eachCell((cell) => {
      cell.font = cell.font?.bold ? cell.font : DATA_FONT;
      cell.border = CELL_BORDER;
      if (!cell.alignment) cell.alignment = { vertical: "middle", wrapText: true };
    });
    // Zebra stripe
    if (isEven) {
      row.eachCell((cell) => {
        if (!cell.fill || !(cell.fill as ExcelJS.FillPattern).fgColor) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
        }
      });
    }
    if (statusIdx > 0) applyColorFill(row.getCell(statusIdx), STATUS_COLORS, String(row.getCell(statusIdx).value ?? ""));
    if (sevIdx > 0) applyColorFill(row.getCell(sevIdx), SEVERITY_COLORS, String(row.getCell(sevIdx).value ?? ""));
    if (scoreIdx > 0) {
      const v = Number(row.getCell(scoreIdx).value);
      if (!isNaN(v) && v > 0) applyScoreFill(row.getCell(scoreIdx), v);
    }
  });
}

function d(val: any): string {
  if (!val) return "";
  return String(val).slice(0, 10);
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const validTypes = ["certifications", "risks", "audits", "assets", "incidents", "changes", "nonconformities", "capas"];
  if (!type || !validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/${type}`, { headers });
  const rows = await res.json();
  if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 500 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Complyva";
  wb.created = new Date();

  const TITLES: Record<string, string> = {
    certifications: "Certifications", risks: "Risk Register", audits: "Audits",
    assets: "Asset Register", incidents: "Incidents", changes: "Change Requests",
    nonconformities: "Non-Conformities", capas: "CAPAs",
  };

  const ws = wb.addWorksheet(TITLES[type]);

  if (type === "certifications") {
    setupSheet(ws, [
      { header: "Name", key: "name", width: 30 }, { header: "Framework", key: "framework_type", width: 20 },
      { header: "Issuing Body", key: "issuing_body", width: 20 }, { header: "Issue Date", key: "issue_date", width: 14 },
      { header: "Expiry Date", key: "expiry_date", width: 14 }, { header: "Status", key: "status", width: 14 },
      { header: "Notes", key: "notes", width: 40 }, { header: "Created", key: "created_at", width: 14 },
    ]);
    for (const r of rows) ws.addRow({ name: r.name, framework_type: r.framework_type || "", issuing_body: r.issuing_body || "",
      issue_date: d(r.issue_date), expiry_date: d(r.expiry_date), status: r.status, notes: r.notes || "", created_at: d(r.created_at) });
    styleDataRows(ws, { statusCol: "status" });

  } else if (type === "risks") {
    setupSheet(ws, [
      { header: "Title", key: "title", width: 35 }, { header: "Category", key: "category", width: 18 },
      { header: "Likelihood", key: "likelihood", width: 12 }, { header: "Impact", key: "impact", width: 10 },
      { header: "Inherent Score", key: "inherent_score", width: 14 },
      { header: "Res. Likelihood", key: "res_l", width: 14 }, { header: "Res. Impact", key: "res_i", width: 12 },
      { header: "Residual Score", key: "res_score", width: 14 },
      { header: "Status", key: "status", width: 16 }, { header: "Treatment Plan", key: "treatment_plan", width: 35 },
      { header: "Due Date", key: "due_date", width: 14 }, { header: "Created", key: "created_at", width: 14 },
    ]);
    for (const r of rows) ws.addRow({ title: r.title, category: r.category || "", likelihood: r.likelihood, impact: r.impact,
      inherent_score: r.inherent_score, res_l: r.residual_likelihood ?? "", res_i: r.residual_impact ?? "",
      res_score: r.residual_score ?? "", status: r.status.replace(/_/g, " "),
      treatment_plan: r.treatment_plan || "", due_date: d(r.due_date), created_at: d(r.created_at) });
    styleDataRows(ws, { statusCol: "status", scoreCol: "inherent_score" });

  } else if (type === "audits") {
    setupSheet(ws, [
      { header: "Title", key: "title", width: 35 }, { header: "Type", key: "type", width: 16 },
      { header: "Auditor", key: "auditor", width: 20 }, { header: "Scope", key: "scope", width: 35 },
      { header: "Start Date", key: "start_date", width: 14 }, { header: "End Date", key: "end_date", width: 14 },
      { header: "Status", key: "status", width: 16 }, { header: "Created", key: "created_at", width: 14 },
    ]);
    for (const r of rows) ws.addRow({ title: r.title, type: r.type, auditor: r.auditor || "", scope: r.scope || "",
      start_date: d(r.start_date), end_date: d(r.end_date), status: r.status, created_at: d(r.created_at) });
    styleDataRows(ws, { statusCol: "status" });

  } else if (type === "assets") {
    setupSheet(ws, [
      { header: "Name", key: "name", width: 28 }, { header: "Type", key: "asset_type", width: 14 },
      { header: "Category", key: "category", width: 16 }, { header: "Owner", key: "owner", width: 18 },
      { header: "BIA", key: "bia_score", width: 8 }, { header: "DCA", key: "dca_score", width: 8 },
      { header: "Classification", key: "combined", width: 14 }, { header: "Status", key: "status", width: 14 },
      { header: "Review Date", key: "review_date", width: 14 }, { header: "Description", key: "description", width: 30 },
      { header: "Notes", key: "notes", width: 30 }, { header: "Created", key: "created_at", width: 14 },
    ]);
    for (const r of rows) ws.addRow({ name: r.name, asset_type: r.asset_type, category: r.category || "", owner: r.owner || "",
      bia_score: r.bia_score ?? "", dca_score: r.dca_score ?? "", combined: r.combined_classification ?? "",
      status: r.status, review_date: d(r.review_date), description: r.description || "", notes: r.notes || "", created_at: d(r.created_at) });
    styleDataRows(ws, { statusCol: "status" });

  } else if (type === "incidents") {
    setupSheet(ws, [
      { header: "Title", key: "title", width: 32 }, { header: "Severity", key: "severity", width: 12 },
      { header: "Category", key: "category", width: 16 }, { header: "Linked Asset", key: "asset_name", width: 18 },
      { header: "Status", key: "status", width: 16 }, { header: "Incident Date", key: "incident_date", width: 14 },
      { header: "Detected Date", key: "detected_date", width: 14 }, { header: "Reported By", key: "reported_by", width: 16 },
      { header: "Assigned To", key: "assigned_to", width: 16 }, { header: "Root Cause", key: "root_cause", width: 30 },
      { header: "Immediate Action", key: "immediate_action", width: 30 }, { header: "Corrective Action", key: "corrective_action", width: 30 },
      { header: "Resolved Date", key: "resolved_date", width: 14 }, { header: "Created", key: "created_at", width: 14 },
    ]);
    for (const r of rows) ws.addRow({ title: r.title, severity: r.severity, category: r.category || "", asset_name: r.asset_name || "",
      status: r.status, incident_date: d(r.incident_date), detected_date: d(r.detected_date),
      reported_by: r.reported_by || "", assigned_to: r.assigned_to || "", root_cause: r.root_cause || "",
      immediate_action: r.immediate_action || "", corrective_action: r.corrective_action || "",
      resolved_date: d(r.resolved_date), created_at: d(r.created_at) });
    styleDataRows(ws, { statusCol: "status", severityCol: "severity" });

  } else if (type === "changes") {
    setupSheet(ws, [
      { header: "Title", key: "title", width: 32 }, { header: "Type", key: "change_type", width: 14 },
      { header: "Priority", key: "priority", width: 12 }, { header: "Affected Asset", key: "asset_name", width: 18 },
      { header: "Status", key: "status", width: 16 }, { header: "Requested By", key: "requested_by", width: 16 },
      { header: "Approved By", key: "approved_by", width: 16 }, { header: "Implemented By", key: "implemented_by", width: 16 },
      { header: "Planned Start", key: "planned_start", width: 14 }, { header: "Planned End", key: "planned_end", width: 14 },
      { header: "Actual Start", key: "actual_start", width: 14 }, { header: "Actual End", key: "actual_end", width: 14 },
      { header: "Created", key: "created_at", width: 14 },
    ]);
    for (const r of rows) ws.addRow({ title: r.title, change_type: r.change_type, priority: r.priority, asset_name: r.asset_name || "",
      status: r.status, requested_by: r.requested_by || "", approved_by: r.approved_by || "",
      implemented_by: r.implemented_by || "", planned_start: d(r.planned_start), planned_end: d(r.planned_end),
      actual_start: d(r.actual_start), actual_end: d(r.actual_end), created_at: d(r.created_at) });
    styleDataRows(ws, { statusCol: "status", severityCol: "priority" });

  } else if (type === "nonconformities") {
    setupSheet(ws, [
      { header: "Title", key: "title", width: 32 }, { header: "Severity", key: "severity", width: 14 },
      { header: "Source", key: "source_type", width: 14 }, { header: "Category", key: "category", width: 16 },
      { header: "Linked Asset", key: "asset_name", width: 18 }, { header: "Status", key: "status", width: 14 },
      { header: "Raised By", key: "raised_by", width: 16 }, { header: "Assigned To", key: "assigned_to", width: 16 },
      { header: "Due Date", key: "due_date", width: 14 }, { header: "Root Cause", key: "root_cause", width: 30 },
      { header: "Containment", key: "containment_action", width: 30 }, { header: "Closed Date", key: "closed_date", width: 14 },
      { header: "Created", key: "created_at", width: 14 },
    ]);
    for (const r of rows) ws.addRow({ title: r.title, severity: r.severity, source_type: r.source_type, category: r.category || "",
      asset_name: r.asset_name || "", status: r.status, raised_by: r.raised_by || "", assigned_to: r.assigned_to || "",
      due_date: d(r.due_date), root_cause: r.root_cause || "", containment_action: r.containment_action || "",
      closed_date: d(r.closed_date), created_at: d(r.created_at) });
    styleDataRows(ws, { statusCol: "status", severityCol: "severity" });

  } else if (type === "capas") {
    setupSheet(ws, [
      { header: "Title", key: "title", width: 32 }, { header: "Type", key: "capa_type", width: 14 },
      { header: "Priority", key: "priority", width: 12 }, { header: "Source", key: "source_type", width: 12 },
      { header: "Linked Asset", key: "asset_name", width: 18 }, { header: "Status", key: "status", width: 14 },
      { header: "Effectiveness", key: "effectiveness_status", width: 16 },
      { header: "Raised By", key: "raised_by", width: 16 }, { header: "Assigned To", key: "assigned_to", width: 16 },
      { header: "Due Date", key: "due_date", width: 14 }, { header: "Root Cause", key: "root_cause", width: 28 },
      { header: "Action Plan", key: "action_plan", width: 28 }, { header: "Verification", key: "verification_method", width: 24 },
      { header: "Completed", key: "completed_date", width: 14 }, { header: "Verified", key: "verified_date", width: 14 },
      { header: "Created", key: "created_at", width: 14 },
    ]);
    for (const r of rows) ws.addRow({ title: r.title, capa_type: r.capa_type, priority: r.priority, source_type: r.source_type || "",
      asset_name: r.asset_name || "", status: r.status, effectiveness_status: r.effectiveness_status || "",
      raised_by: r.raised_by || "", assigned_to: r.assigned_to || "", due_date: d(r.due_date),
      root_cause: r.root_cause || "", action_plan: r.action_plan || "", verification_method: r.verification_method || "",
      completed_date: d(r.completed_date), verified_date: d(r.verified_date), created_at: d(r.created_at) });
    styleDataRows(ws, { statusCol: "status", severityCol: "priority" });
  }

  // Summary row
  const summaryRow = ws.addRow([]);
  summaryRow.getCell(1).value = `Total: ${rows.length} records · Exported ${new Date().toISOString().slice(0, 10)}`;
  summaryRow.getCell(1).font = { ...DATA_FONT, bold: true, italic: true, color: { argb: "FF6B7280" } };

  const buffer = await wb.xlsx.writeBuffer();
  const now = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${type}_export_${now}.xlsx"`,
    },
  });
}

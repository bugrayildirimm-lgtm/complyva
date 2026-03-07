import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

const API_BASE = process.env.API_BASE ?? "http://localhost:4000";

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) throw new Error("Not signed in");

  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) throw new Error("Auth failed");
  const me = await meRes.json();

  // Check export permission
  const orgRes = await fetch(`${API_BASE}/account`, {
    headers: {
      "x-org-id": me.org_id,
      "x-user-id": me.id,
      "x-role": me.role,
    },
  });
  if (orgRes.ok) {
    const orgData = await orgRes.json();
    const allowedRoles = orgData.org?.export_allowed_roles || ["ADMIN", "AUDITOR", "VIEWER"];
    if (!allowedRoles.includes(me.role)) {
      throw new Error("You don't have permission to export data. Contact your admin.");
    }
  }

  return {
    "x-org-id": me.org_id,
    "x-user-id": me.id,
    "x-role": me.role,
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
    // Category header colors
    const CAT_FILLS: Record<string, string> = {
      id: "FF374151", inherent: "FFDC2626", residual: "FFD97706",
      action: "FF2563EB", monitor: "FF7C3AED", cost: "FF0F766E",
    };
    const catFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Arial" };

    // Define columns with category groupings
    const cols = [
      // Risk Identification
      { header: "RID #", key: "rid_number", width: 10, cat: "id" },
      { header: "Process Name", key: "process_name", width: 16, cat: "id" },
      { header: "Sub-Process", key: "sub_process", width: 14, cat: "id" },
      { header: "Risk Owner", key: "risk_owner", width: 14, cat: "id" },
      { header: "Risk Category", key: "category", width: 14, cat: "id" },
      { header: "Risk Name", key: "title", width: 28, cat: "id" },
      { header: "Risk Description", key: "risk_description", width: 35, cat: "id" },
      { header: "Clarification", key: "clarification", width: 25, cat: "id" },
      { header: "Opportunities", key: "opportunities", width: 20, cat: "id" },
      { header: "Target Benefit", key: "target_benefit", width: 14, cat: "id" },
      { header: "Existing Controls", key: "existing_controls", width: 28, cat: "id" },
      { header: "Effectiveness of Controls", key: "control_effectiveness_desc", width: 20, cat: "id" },
      // Inherent Risk Assessment
      { header: "Impact (1-5)", key: "impact", width: 12, cat: "inherent" },
      { header: "Impact Desc", key: "impact_desc", width: 14, cat: "inherent" },
      { header: "Frequency (1-5)", key: "frequency", width: 14, cat: "inherent" },
      { header: "Frequency Desc", key: "frequency_desc", width: 14, cat: "inherent" },
      { header: "Risk Score", key: "inherent_score", width: 12, cat: "inherent" },
      { header: "Inherent Risk Level", key: "inherent_risk_desc", width: 16, cat: "inherent" },
      // Residual Risk Assessment
      { header: "Control Score (1-5)", key: "control_score", width: 16, cat: "residual" },
      { header: "Control Effectiveness", key: "control_effectiveness_label", width: 20, cat: "residual" },
      { header: "Residual Score", key: "residual_score", width: 14, cat: "residual" },
      { header: "Residual Risk Level", key: "residual_risk_desc", width: 16, cat: "residual" },
      // Action Plan
      { header: "Risk Strategy", key: "risk_strategy", width: 22, cat: "action" },
      { header: "Proposed Actions", key: "proposed_actions", width: 30, cat: "action" },
      { header: "Deadline", key: "deadline", width: 12, cat: "action" },
      { header: "Responsible", key: "responsible", width: 14, cat: "action" },
      { header: "Status", key: "status", width: 14, cat: "action" },
      // Monitoring & Reporting
      { header: "Monitoring Period", key: "monitoring_period", width: 20, cat: "monitor" },
      { header: "Reporting", key: "reporting", width: 30, cat: "monitor" },
      { header: "Last Reviewed", key: "last_reviewed", width: 12, cat: "monitor" },
      // Cost-Impact Calculation
      { header: "Probability", key: "probability", width: 12, cat: "cost" },
      { header: "Min Cost", key: "min_cost", width: 12, cat: "cost" },
      { header: "Most Likely Cost", key: "most_likely_cost", width: 14, cat: "cost" },
      { header: "Max Cost", key: "max_cost", width: 12, cat: "cost" },
      { header: "Expected Value", key: "expected_value", width: 14, cat: "cost" },
      { header: "Opportunity Impact", key: "opportunity_impact", width: 16, cat: "cost" },
    ];

    // Set column widths without overwriting rows
    cols.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = c.width;
      col.key = c.key;
    });

    // Row 2: Field headers (write first so ws.columns doesn't wipe them)
    const headerRow = ws.getRow(2);
    cols.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = CELL_BORDER;
    });
    headerRow.height = 32;

    // Row 1: Category headers (merged) — written AFTER row 2 so nothing overwrites it
    const catNames: Record<string, string> = {
      id: "Risk Identification", inherent: "Inherent Risk (Assessment)",
      residual: "Residual Risk (Assessment)", action: "Action Plan (Treatment)",
      monitor: "Monitoring and Reporting", cost: "Cost-Impact Calculation",
    };
    const catRow = ws.getRow(1);
    const catRanges: { cat: string; start: number; end: number }[] = [];
    let curCat = cols[0].cat;
    let curStart = 1;
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].cat !== curCat) {
        catRanges.push({ cat: curCat, start: curStart, end: i });
        curCat = cols[i].cat;
        curStart = i + 1;
      }
    }
    catRanges.push({ cat: curCat, start: curStart, end: cols.length });

    for (const range of catRanges) {
      if (range.end > range.start) {
        ws.mergeCells(1, range.start, 1, range.end);
      }
      const cell = catRow.getCell(range.start);
      cell.value = catNames[range.cat] || range.cat;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CAT_FILLS[range.cat] || "FF374151" } };
      cell.font = catFont;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = CELL_BORDER;
    }
    catRow.height = 24;

    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: cols.length } };

    // Data rows
    for (const r of rows) {
      const row = ws.addRow({
        rid_number: r.rid_number || "", process_name: r.process_name || "",
        sub_process: r.sub_process || "", risk_owner: r.risk_owner || "",
        category: r.category || "", title: r.title,
        risk_description: r.risk_description || r.description || "",
        clarification: r.clarification || "", opportunities: r.opportunities || "",
        target_benefit: r.target_benefit ?? "", existing_controls: r.existing_controls || "",
        control_effectiveness_desc: r.control_effectiveness_desc || "",
        impact: r.impact, impact_desc: r.impact_desc || "",
        frequency: r.frequency || r.likelihood, frequency_desc: r.frequency_desc || "",
        inherent_score: r.inherent_score ?? (r.impact * (r.frequency || r.likelihood)),
        inherent_risk_desc: r.inherent_risk_desc || "",
        control_score: r.control_score ?? "", control_effectiveness_label: r.control_effectiveness_label || "",
        residual_score: r.residual_score ?? "", residual_risk_desc: r.residual_risk_desc || "",
        risk_strategy: r.risk_strategy || "", proposed_actions: r.proposed_actions || r.treatment_plan || "",
        deadline: d(r.deadline || r.due_date), responsible: r.responsible || "",
        status: (r.status || "").replace(/_/g, " "),
        monitoring_period: r.monitoring_period || "", reporting: r.reporting || "",
        last_reviewed: d(r.last_reviewed),
        probability: r.probability ?? "", min_cost: r.min_cost ?? "",
        most_likely_cost: r.most_likely_cost ?? "", max_cost: r.max_cost ?? "",
        expected_value: r.expected_value ?? "", opportunity_impact: r.opportunity_impact ?? "",
      });
    }

    // Style data rows
    const scoreColIdx = cols.findIndex((c) => c.key === "inherent_score") + 1;
    const resScoreIdx = cols.findIndex((c) => c.key === "residual_score") + 1;
    const statusColIdx = cols.findIndex((c) => c.key === "status") + 1;
    ws.eachRow((row, rowNum) => {
      if (rowNum <= 2) return;
      const isEven = rowNum % 2 === 0;
      row.eachCell((cell) => {
        cell.font = cell.font?.bold ? cell.font : DATA_FONT;
        cell.border = CELL_BORDER;
        if (!cell.alignment) cell.alignment = { vertical: "middle", wrapText: true };
      });
      if (isEven) {
        row.eachCell((cell) => {
          if (!cell.fill || !(cell.fill as ExcelJS.FillPattern).fgColor) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
          }
        });
      }
      if (scoreColIdx > 0) {
        const v = Number(row.getCell(scoreColIdx).value);
        if (!isNaN(v) && v > 0) applyScoreFill(row.getCell(scoreColIdx), v);
      }
      if (resScoreIdx > 0) {
        const v = Number(row.getCell(resScoreIdx).value);
        if (!isNaN(v) && v > 0) applyScoreFill(row.getCell(resScoreIdx), v);
      }
      if (statusColIdx > 0) applyColorFill(row.getCell(statusColIdx), STATUS_COLORS, String(row.getCell(statusColIdx).value ?? ""));
    });

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

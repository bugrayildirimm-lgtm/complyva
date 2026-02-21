import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

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

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  if (!type || !["certifications", "risks", "audits", "assets", "incidents", "changes", "nonconformities"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/${type}`, { headers });
  const rows = await res.json();
  if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 500 });

  let csvContent = "";
  const now = new Date().toISOString().slice(0, 10);

  if (type === "certifications") {
    csvContent = "Name,Framework Type,Issuing Body,Issue Date,Expiry Date,Status,Notes,Created At\n";
    for (const r of rows) {
      csvContent += [
        esc(r.name), esc(r.framework_type), esc(r.issuing_body),
        r.issue_date ? String(r.issue_date).slice(0, 10) : "",
        r.expiry_date ? String(r.expiry_date).slice(0, 10) : "",
        r.status, esc(r.notes), String(r.created_at).slice(0, 10),
      ].join(",") + "\n";
    }
  } else if (type === "risks") {
    csvContent = "Title,Category,Likelihood,Impact,Inherent Score,Residual Likelihood,Residual Impact,Residual Score,Status,Treatment Plan,Due Date,Created At\n";
    for (const r of rows) {
      csvContent += [
        esc(r.title), esc(r.category), r.likelihood, r.impact, r.inherent_score,
        r.residual_likelihood ?? "", r.residual_impact ?? "", r.residual_score ?? "",
        r.status, esc(r.treatment_plan),
        r.due_date ? String(r.due_date).slice(0, 10) : "",
        String(r.created_at).slice(0, 10),
      ].join(",") + "\n";
    }
  } else if (type === "audits") {
    csvContent = "Title,Type,Auditor,Scope,Start Date,End Date,Status,Created At\n";
    for (const r of rows) {
      csvContent += [
        esc(r.title), r.type, esc(r.auditor), esc(r.scope),
        r.start_date ? String(r.start_date).slice(0, 10) : "",
        r.end_date ? String(r.end_date).slice(0, 10) : "",
        r.status, String(r.created_at).slice(0, 10),
      ].join(",") + "\n";
    }
  } else if (type === "assets") {
    csvContent = "Name,Asset Type,Category,Owner,BIA Score,DCA Score,Combined Classification,Status,Review Date,Description,Notes,Created At\n";
    for (const r of rows) {
      csvContent += [
        esc(r.name), r.asset_type, esc(r.category), esc(r.owner),
        r.bia_score ?? "", r.dca_score ?? "", r.combined_classification ?? "",
        r.status,
        r.review_date ? String(r.review_date).slice(0, 10) : "",
        esc(r.description), esc(r.notes),
        String(r.created_at).slice(0, 10),
      ].join(",") + "\n";
    }
  } else if (type === "incidents") {
    csvContent = "Title,Severity,Category,Linked Asset,Status,Incident Date,Detected Date,Reported By,Assigned To,Root Cause,Immediate Action,Corrective Action,Resolved Date,Created At\n";
    for (const r of rows) {
      csvContent += [
        esc(r.title), r.severity, esc(r.category), esc(r.asset_name),
        r.status,
        r.incident_date ? String(r.incident_date).slice(0, 10) : "",
        r.detected_date ? String(r.detected_date).slice(0, 10) : "",
        esc(r.reported_by), esc(r.assigned_to),
        esc(r.root_cause), esc(r.immediate_action), esc(r.corrective_action),
        r.resolved_date ? String(r.resolved_date).slice(0, 10) : "",
        String(r.created_at).slice(0, 10),
      ].join(",") + "\n";
    }
  } else if (type === "changes") {
    csvContent = "Title,Change Type,Priority,Affected Asset,Status,Requested By,Approved By,Implemented By,Planned Start,Planned End,Actual Start,Actual End,Created At\n";
    for (const r of rows) {
      csvContent += [
        esc(r.title), r.change_type, r.priority, esc(r.asset_name),
        r.status, esc(r.requested_by), esc(r.approved_by), esc(r.implemented_by),
        r.planned_start ? String(r.planned_start).slice(0, 10) : "",
        r.planned_end ? String(r.planned_end).slice(0, 10) : "",
        r.actual_start ? String(r.actual_start).slice(0, 10) : "",
        r.actual_end ? String(r.actual_end).slice(0, 10) : "",
        String(r.created_at).slice(0, 10),
      ].join(",") + "\n";
    }
  } else if (type === "nonconformities") {
    csvContent = "Title,Severity,Source,Category,Linked Asset,Status,Raised By,Assigned To,Due Date,Root Cause,Containment Action,Closed Date,Created At\n";
    for (const r of rows) {
      csvContent += [
        esc(r.title), r.severity, r.source_type, esc(r.category), esc(r.asset_name),
        r.status, esc(r.raised_by), esc(r.assigned_to),
        r.due_date ? String(r.due_date).slice(0, 10) : "",
        esc(r.root_cause), esc(r.containment_action),
        r.closed_date ? String(r.closed_date).slice(0, 10) : "",
        String(r.created_at).slice(0, 10),
      ].join(",") + "\n";
    }
  }

  const fileName = `${type}_export_${now}.csv`;

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

function esc(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

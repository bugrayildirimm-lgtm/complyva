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
  if (!type || !["certifications", "risks", "audits"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/${type}`, { headers });
  const rows = await res.json();
  if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 500 });

  // Build CSV (universal, no dependencies needed)
  let csvContent = "";
  const now = new Date().toISOString().slice(0, 10);

  if (type === "certifications") {
    csvContent = "Name,Framework Type,Issuing Body,Issue Date,Expiry Date,Status,Notes,Created At\n";
    for (const r of rows) {
      csvContent += [
        esc(r.name),
        esc(r.framework_type),
        esc(r.issuing_body),
        r.issue_date ? String(r.issue_date).slice(0, 10) : "",
        r.expiry_date ? String(r.expiry_date).slice(0, 10) : "",
        r.status,
        esc(r.notes),
        String(r.created_at).slice(0, 10),
      ].join(",") + "\n";
    }
  } else if (type === "risks") {
    csvContent = "Title,Category,Likelihood,Impact,Inherent Score,Residual Likelihood,Residual Impact,Residual Score,Status,Treatment Plan,Due Date,Created At\n";
    for (const r of rows) {
      csvContent += [
        esc(r.title),
        esc(r.category),
        r.likelihood,
        r.impact,
        r.inherent_score,
        r.residual_likelihood ?? "",
        r.residual_impact ?? "",
        r.residual_score ?? "",
        r.status,
        esc(r.treatment_plan),
        r.due_date ? String(r.due_date).slice(0, 10) : "",
        String(r.created_at).slice(0, 10),
      ].join(",") + "\n";
    }
  } else if (type === "audits") {
    csvContent = "Title,Type,Auditor,Scope,Start Date,End Date,Status,Created At\n";
    for (const r of rows) {
      csvContent += [
        esc(r.title),
        r.type,
        esc(r.auditor),
        esc(r.scope),
        r.start_date ? String(r.start_date).slice(0, 10) : "",
        r.end_date ? String(r.end_date).slice(0, 10) : "",
        r.status,
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

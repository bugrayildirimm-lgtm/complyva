import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE ?? "http://localhost:4000";

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) return NextResponse.json({ error: "Auth failed" }, { status: 401 });
  const me = await meRes.json();

  const fileRes = await fetch(`${API_BASE}/evidence/download/${fileId}`, {
    headers: {
      "x-org-id": me.org_id,
      "x-user-id": me.id,
      "x-role": me.role,
    },
  });

  if (!fileRes.ok) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const buffer = await fileRes.arrayBuffer();
  const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
  const contentDisposition = fileRes.headers.get("content-disposition") || "";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
    },
  });
}

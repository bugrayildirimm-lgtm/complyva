import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE ?? "http://localhost:4000";

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const { userId: clerkUserId } = await auth();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Sync user to get org/role
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
  if (!syncRes.ok) return NextResponse.json({ error: "Auth failed" }, { status: 401 });

  // Fetch file from API
  const fileRes = await fetch(`${API_BASE}/evidence/download/${fileId}`, {
    headers: {
      "x-org-id": syncData.orgId,
      "x-user-id": syncData.userId,
      "x-role": syncData.role,
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

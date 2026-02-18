import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";

const API_BASE = process.env.API_BASE || "http://localhost:4000";

async function getDbUser() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new Error("Not signed in");

  const user = await currentUser();
  if (!user) throw new Error("Not signed in");

  const res = await fetch(`${API_BASE}/auth/sync`, {
    method: "POST",
    headers: {
      "x-clerk-user-id": clerkUserId,
      "x-clerk-email": user.emailAddresses[0]?.emailAddress ?? "",
      "x-clerk-name": `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
    },
    body: "{}",
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Sync failed");
  return data as { userId: string; orgId: string; role: string };
}

async function apiFetch(path: string, init?: RequestInit) {
  const dbUser = await getDbUser();

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "x-org-id": dbUser.orgId,
      "x-user-id": dbUser.userId,
      "x-role": dbUser.role,
    },
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = data?.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ---------- Reads ----------
export async function getSummary() {
  return apiFetch("/dashboard/summary");
}
export async function getCertifications() {
  return apiFetch("/certifications");
}
export async function getRisks() {
  return apiFetch("/risks");
}
export async function getAudits() {
  return apiFetch("/audits");
}
export async function getFindings(auditId: string) {
  return apiFetch(`/audits/${auditId}/findings`);
}

// ---------- Helpers ----------
function str(formData: FormData, name: string) {
  const v = String(formData.get(name) ?? "").trim();
  return v === "" ? undefined : v;
}

function num(formData: FormData, name: string, fallback: number) {
  const v = formData.get(name);
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

// ---------- Writes (Server Actions) ----------
export async function createCertification(formData: FormData) {
  "use server";
  const payload = {
    name: String(formData.get("name") ?? ""),
    frameworkType: str(formData, "frameworkType"),
    issuingBody: str(formData, "issuingBody"),
    issueDate: str(formData, "issueDate"),
    expiryDate: str(formData, "expiryDate"),
    notes: str(formData, "notes"),
  };

  await apiFetch("/certifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  revalidatePath("/certifications");
  revalidatePath("/dashboard");
}

export async function createRisk(formData: FormData) {
  "use server";
  const payload = {
    title: String(formData.get("title") ?? ""),
    category: str(formData, "category"),
    likelihood: num(formData, "likelihood", 3),
    impact: num(formData, "impact", 3),
    treatmentPlan: str(formData, "treatmentPlan"),
    dueDate: str(formData, "dueDate"),
  };

  await apiFetch("/risks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  revalidatePath("/risks");
  revalidatePath("/dashboard");
}

export async function createAudit(formData: FormData) {
  "use server";
  const payload = {
    type: String(formData.get("type") ?? "INTERNAL"),
    title: String(formData.get("title") ?? ""),
    scope: str(formData, "scope"),
    auditor: str(formData, "auditor"),
    startDate: str(formData, "startDate"),
    status: String(formData.get("status") ?? "PLANNED"),
  };

  await apiFetch("/audits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  revalidatePath("/audits");
  revalidatePath("/dashboard");
}

export async function createFinding(auditId: string, formData: FormData) {
  "use server";
  const payload = {
    auditId,
    title: String(formData.get("title") ?? ""),
    severity: String(formData.get("severity") ?? "MEDIUM"),
    recommendation: str(formData, "recommendation"),
    dueDate: str(formData, "dueDate"),
  };

  await apiFetch("/findings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  revalidatePath(`/audits/${auditId}`);
  revalidatePath("/dashboard");
}
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const API_BASE = process.env.API_BASE ?? "http://localhost:4000";

// --- helpers ---
function str(formData: FormData, name: string) {
  const v = String(formData.get(name) ?? "").trim();
  return v === "" ? undefined : v;
}

function num(formData: FormData, name: string, fallback: number) {
  const v = formData.get(name);
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

// --- DB user sync ---
async function getDbUser() {
  const { userId: clerkUserId } = await auth();
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");

  const res = await fetch(`${API_BASE}/auth/sync`, {
    method: "POST",
    headers: {
      "x-clerk-user-id": clerkUserId!,
      "x-clerk-email": user.emailAddresses[0]?.emailAddress ?? "",
      "x-clerk-name": `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
    },
    body: "{}",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Sync failed");
  return data as { userId: string; orgId: string; role: string };
}

// --- Generic fetch ---
async function apiFetch(path: string, init?: RequestInit) {
  const dbUser = await getDbUser();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      "x-org-id": dbUser.orgId,
      "x-user-id": dbUser.userId,
      "x-role": dbUser.role,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ---------- Dashboard ----------
export async function getSummary() {
  return apiFetch("/dashboard/summary");
}

// ---------- Certifications ----------
export async function getCertifications() {
  return apiFetch("/certifications");
}

export async function createCertification(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) {
    redirect("/certifications");
    return;
  }

  const payload = {
    name,
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

// ---------- Risks ----------
export async function getRisks() {
  return apiFetch("/risks");
}

export async function createRisk(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) {
    redirect("/risks");
    return;
  }

  const payload = {
    title,
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

// ---------- Audits ----------
export async function getAudits() {
  return apiFetch("/audits");
}

export async function createAudit(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) {
    redirect("/audits");
    return;
  }

  const payload = {
    type: String(formData.get("type") ?? "INTERNAL"),
    title,
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

// ---------- Findings ----------
export async function getFindings(auditId: string) {
  return apiFetch(`/audits/${auditId}/findings`);
}

export async function createFinding(auditId: string, formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) {
    redirect(`/audits/${auditId}`);
    return;
  }

  const payload = {
    auditId,
    title,
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

// ---------- Evidence Files ----------
export async function uploadEvidence(entityType: string, entityId: string, formData: FormData) {
  "use server";
  const dbUser = await getDbUser();

  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("No file selected");

  const uploadForm = new FormData();
  uploadForm.append("file", file);

  const res = await fetch(`${API_BASE}/evidence/upload?entityType=${entityType}&entityId=${entityId}`, {
    method: "POST",
    headers: {
      "x-org-id": dbUser.orgId,
      "x-user-id": dbUser.userId,
      "x-role": dbUser.role,
    },
    body: uploadForm,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Upload failed");
  return data;
}

export async function getEvidence(entityType: string, entityId: string) {
  return apiFetch(`/evidence/${entityType}/${entityId}`);
}

export async function deleteEvidence(fileId: string) {
  "use server";
  const dbUser = await getDbUser();

  const res = await fetch(`${API_BASE}/evidence/${fileId}`, {
    method: "DELETE",
    headers: {
      "x-org-id": dbUser.orgId,
      "x-user-id": dbUser.userId,
      "x-role": dbUser.role,
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Delete failed");
  return data;
}
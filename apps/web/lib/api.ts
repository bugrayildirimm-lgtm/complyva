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

// ========== Dashboard ==========
export async function getSummary() {
  return apiFetch("/dashboard/summary");
}

// ========== Certifications ==========
export async function getCertifications() {
  return apiFetch("/certifications");
}

export async function getCertification(id: string) {
  return apiFetch(`/certifications/${id}`);
}

export async function createCertification(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) { redirect("/certifications"); return; }

  await apiFetch("/certifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      frameworkType: str(formData, "frameworkType"),
      issuingBody: str(formData, "issuingBody"),
      issueDate: str(formData, "issueDate"),
      expiryDate: str(formData, "expiryDate"),
      notes: str(formData, "notes"),
    }),
  });

  revalidatePath("/certifications");
  revalidatePath("/dashboard");
}

export async function updateCertification(id: string, data: Record<string, any>) {
  "use server";
  await apiFetch(`/certifications/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  revalidatePath(`/certifications/${id}`);
  revalidatePath("/certifications");
  revalidatePath("/dashboard");
}

export async function deleteCertification(id: string) {
  "use server";
  await apiFetch(`/certifications/${id}`, { method: "DELETE" });
  revalidatePath("/certifications");
  revalidatePath("/dashboard");
}

// ========== Risks ==========
export async function getRisks() {
  return apiFetch("/risks");
}

export async function getRisk(id: string) {
  return apiFetch(`/risks/${id}`);
}

export async function createRisk(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) { redirect("/risks"); return; }

  await apiFetch("/risks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      category: str(formData, "category"),
      likelihood: num(formData, "likelihood", 3),
      impact: num(formData, "impact", 3),
      treatmentPlan: str(formData, "treatmentPlan"),
      dueDate: str(formData, "dueDate"),
    }),
  });

  revalidatePath("/risks");
  revalidatePath("/dashboard");
}

export async function updateRisk(id: string, data: Record<string, any>) {
  "use server";
  await apiFetch(`/risks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  revalidatePath(`/risks/${id}`);
  revalidatePath("/risks");
  revalidatePath("/dashboard");
}

export async function deleteRisk(id: string) {
  "use server";
  await apiFetch(`/risks/${id}`, { method: "DELETE" });
  revalidatePath("/risks");
  revalidatePath("/dashboard");
}

// ========== Audits ==========
export async function getAudits() {
  return apiFetch("/audits");
}

export async function getAudit(id: string) {
  return apiFetch(`/audits/${id}`);
}

export async function createAudit(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) { redirect("/audits"); return; }

  await apiFetch("/audits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: String(formData.get("type") ?? "INTERNAL"),
      title,
      scope: str(formData, "scope"),
      auditor: str(formData, "auditor"),
      startDate: str(formData, "startDate"),
      status: String(formData.get("status") ?? "PLANNED"),
    }),
  });

  revalidatePath("/audits");
  revalidatePath("/dashboard");
}

export async function updateAudit(id: string, data: Record<string, any>) {
  "use server";
  await apiFetch(`/audits/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  revalidatePath(`/audits/${id}`);
  revalidatePath("/audits");
  revalidatePath("/dashboard");
}

export async function deleteAudit(id: string) {
  "use server";
  await apiFetch(`/audits/${id}`, { method: "DELETE" });
  revalidatePath("/audits");
  revalidatePath("/dashboard");
}

// ========== Findings ==========
export async function getFindings(auditId: string) {
  return apiFetch(`/audits/${auditId}/findings`);
}

export async function getFinding(id: string) {
  return apiFetch(`/findings/${id}`);
}

export async function createFinding(auditId: string, formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) { redirect(`/audits/${auditId}`); return; }

  await apiFetch("/findings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auditId,
      title,
      severity: String(formData.get("severity") ?? "MEDIUM"),
      recommendation: str(formData, "recommendation"),
      dueDate: str(formData, "dueDate"),
    }),
  });

  revalidatePath(`/audits/${auditId}`);
  revalidatePath("/dashboard");
}

export async function updateFinding(id: string, data: Record<string, any>) {
  "use server";
  await apiFetch(`/findings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  revalidatePath(`/findings`);
  revalidatePath("/dashboard");
}

export async function deleteFinding(id: string, auditId: string) {
  "use server";
  await apiFetch(`/findings/${id}`, { method: "DELETE" });
  revalidatePath(`/audits/${auditId}`);
  revalidatePath("/dashboard");
}

export async function sendFindingToRisk(findingId: string) {
  "use server";
  const result = await apiFetch(`/findings/${findingId}/send-to-risk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  revalidatePath("/risks");
  revalidatePath("/dashboard");
  return result;
}

// ========== Assets ==========
export async function getAssets() {
  return apiFetch("/assets");
}

export async function getAsset(id: string) {
  return apiFetch(`/assets/${id}`);
}

export async function createAsset(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) { redirect("/assets"); return; }

  await apiFetch("/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      description: str(formData, "description"),
      category: str(formData, "category"),
      assetType: String(formData.get("assetType") ?? "SYSTEM"),
      owner: str(formData, "owner"),
      biaScore: formData.get("biaScore") ? num(formData, "biaScore", 1) : undefined,
      dcaScore: formData.get("dcaScore") ? num(formData, "dcaScore", 1) : undefined,
      reviewDate: str(formData, "reviewDate"),
      notes: str(formData, "notes"),
    }),
  });

  revalidatePath("/assets");
  revalidatePath("/dashboard");
}

export async function updateAsset(id: string, data: Record<string, any>) {
  "use server";
  await apiFetch(`/assets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  revalidatePath(`/assets/${id}`);
  revalidatePath("/assets");
  revalidatePath("/dashboard");
}

export async function deleteAsset(id: string) {
  "use server";
  await apiFetch(`/assets/${id}`, { method: "DELETE" });
  revalidatePath("/assets");
  revalidatePath("/dashboard");
}

// ========== Incidents ==========
export async function getIncidents() {
  return apiFetch("/incidents");
}

export async function getIncident(id: string) {
  return apiFetch(`/incidents/${id}`);
}

export async function createIncident(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) { redirect("/incidents"); return; }

  await apiFetch("/incidents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      description: str(formData, "description"),
      incidentDate: str(formData, "incidentDate"),
      detectedDate: str(formData, "detectedDate"),
      category: str(formData, "category"),
      severity: String(formData.get("severity") ?? "MEDIUM"),
      assetId: str(formData, "assetId") || undefined,
      reportedBy: str(formData, "reportedBy"),
      assignedTo: str(formData, "assignedTo"),
    }),
  });

  revalidatePath("/incidents");
  revalidatePath("/dashboard");
}

export async function updateIncident(id: string, data: Record<string, any>) {
  "use server";
  await apiFetch(`/incidents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  revalidatePath(`/incidents/${id}`);
  revalidatePath("/incidents");
  revalidatePath("/dashboard");
}

export async function sendIncidentToRisk(incidentId: string) {
  "use server";
  const result = await apiFetch(`/incidents/${incidentId}/send-to-risk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  revalidatePath("/risks");
  revalidatePath("/incidents");
  return result;
}
export async function deleteIncident(id: string) {
  "use server";
  await apiFetch(`/incidents/${id}`, { method: "DELETE" });
  revalidatePath("/incidents");
  revalidatePath("/dashboard");
}

// ========== Evidence Files ==========
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

// ========== Activity Log ==========
export async function getActivity() {
  return apiFetch("/activity");
}

export async function getEntityActivity(entityType: string, entityId: string) {
  return apiFetch(`/activity/${entityType}/${entityId}`);
}

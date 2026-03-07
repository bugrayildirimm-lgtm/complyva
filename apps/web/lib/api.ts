"use server";

import { cookies } from "next/headers";
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

// --- Auth from JWT cookie ---
async function getDbUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/sign-in");

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      redirect("/sign-in");
    }
    const data = await res.json();
    return { userId: data.id, orgId: data.org_id, role: data.role, token } as { userId: string; orgId: string; role: string; token: string };
  } catch (err: any) {
    if (err.message === "NEXT_REDIRECT") throw err;
    console.error("[getDbUser] Auth failed:", err.message);
    redirect("/sign-in");
  }
}

// --- Generic fetch ---
async function apiFetch(path: string, init?: RequestInit) {
  const dbUser = await getDbUser();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${dbUser.token}`,
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
export async function getRiskScoreHistory(id: string) {
  return apiFetch(`/risks/${id}/score-history`);
}

export async function getRisk(id: string) {
  return apiFetch(`/risks/${id}`);
}

export async function createRisk(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) { redirect("/risks"); return; }

  // Convert descriptors to numeric scores
  const impactDesc = str(formData, "impactDesc") || "Moderate";
  const frequencyDesc = str(formData, "frequencyDesc") || "Possible";
  const impactMap: Record<string, number> = { Insignificant: 1, Minor: 2, Moderate: 3, Major: 4, Severe: 5 };
  const freqMap: Record<string, number> = { Rare: 1, Unlikely: 2, Possible: 3, Likely: 4, Certain: 5 };
  const ctrlMap: Record<string, number> = { Strong: 1, "Reasonably Strong": 2, Adequate: 3, Insufficient: 4, Weak: 5 };
  const impact = impactMap[impactDesc] ?? 3;
  const likelihood = freqMap[frequencyDesc] ?? 3;
  const inherentScore = impact * likelihood;
  const inherentRiskDesc = inherentScore > 18 ? "Very High" : inherentScore > 11 ? "High" : inherentScore > 7 ? "Medium" : inherentScore > 3 ? "Low" : "Very Low";
  const inherentLevelScore = inherentScore > 18 ? 5 : inherentScore > 11 ? 4 : inherentScore > 7 ? 3 : inherentScore > 3 ? 2 : 1;

  // Control effectiveness for residual
  const ctrlLabel = str(formData, "controlEffectivenessLabel") || "";
  const ctrlScore = ctrlMap[ctrlLabel] || undefined;
  const residualScore = ctrlScore ? inherentLevelScore * ctrlScore : undefined;
  const residualRiskDesc = residualScore ? (residualScore > 18 ? "Very High" : residualScore > 11 ? "High" : residualScore > 7 ? "Medium" : residualScore > 3 ? "Low" : "Very Low") : undefined;

  // Auto-calculated fields
  const strategyMap: Record<string, string> = { "Very Low": "Accept", "Low": "Accept and Monitor", "Medium": "Reduce or Share (Transfer)", "High": "Reduce, Share, or Avoid", "Very High": "Avoid or Reduce aggressively" };
  const reportingMap: Record<string, string> = { "Very High": "Immediate Breach: Risk Committee/Board", "High": "Immediate Breach: Risk Committee/Board", "Medium": "Escalate Residual Increase: Director Dept/Risk Committee", "Low": "Trends KRI/KCI/Risk Limit: Risk Manager", "Very Low": "Trends KRI/KCI/Risk Limit: Risk Manager" };
  const monitorMap: Record<string, string> = { "Very Low": "Review annually", "Low": "Review every 6 months", "Medium": "Review quarterly", "High": "Review monthly", "Very High": "Review weekly/continuously" };
  const monitorLevel = residualRiskDesc || inherentRiskDesc;

  // Cost fields
  const minCost = str(formData, "minCost") ? Number(str(formData, "minCost")) : undefined;
  const mostLikelyCost = str(formData, "mostLikelyCost") ? Number(str(formData, "mostLikelyCost")) : undefined;
  const maxCost = str(formData, "maxCost") ? Number(str(formData, "maxCost")) : undefined;
  const targetBenefit = str(formData, "targetBenefit") ? Number(str(formData, "targetBenefit")) : undefined;

  await apiFetch("/risks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      category: str(formData, "category") || undefined,
      likelihood,
      impact,
      impactDesc,
      frequencyDesc,
      frequency: freqMap[frequencyDesc],
      inherentRiskDesc,
      riskStrategy: strategyMap[inherentRiskDesc],
      reporting: reportingMap[inherentRiskDesc],
      monitoringPeriod: monitorMap[monitorLevel],
      // Identification
      ridNumber: str(formData, "ridNumber") || undefined,
      processName: str(formData, "processName") || undefined,
      subProcess: str(formData, "subProcess") || undefined,
      riskOwner: str(formData, "riskOwner") || undefined,
      riskDescription: str(formData, "riskDescription") || undefined,
      clarification: str(formData, "clarification") || undefined,
      existingControls: str(formData, "existingControls") || undefined,
      controlEffectivenessDesc: str(formData, "controlEffectivenessDesc") || undefined,
      opportunities: str(formData, "opportunities") || undefined,
      targetBenefit,
      // Residual
      controlEffectivenessLabel: ctrlLabel || undefined,
      controlScore: ctrlScore,
      residualScore,
      residualRiskDesc,
      // Treatment
      proposedActions: str(formData, "proposedActions") || undefined,
      deadline: str(formData, "deadline") || undefined,
      responsible: str(formData, "responsible") || undefined,
      status: str(formData, "status") || "OPEN",
      // Monitoring
      lastReviewed: str(formData, "lastReviewed") || undefined,
      // Cost
      minCost,
      mostLikelyCost,
      maxCost,
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

export async function sendIncidentToNC(incidentId: string) {
  "use server";
  const result = await apiFetch(`/incidents/${incidentId}/send-to-nc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  revalidatePath("/nonconformities");
  revalidatePath("/incidents");
  return result;
}

export async function sendNCToCAPA(ncId: string) {
  "use server";
  const result = await apiFetch(`/nonconformities/${ncId}/send-to-capa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  revalidatePath("/capas");
  revalidatePath("/nonconformities");
  return result;
}

export async function deleteIncident(id: string) {
  "use server";
  await apiFetch(`/incidents/${id}`, { method: "DELETE" });
  revalidatePath("/incidents");
  revalidatePath("/dashboard");
}

// ========== Changes ==========
export async function getChanges() {
  return apiFetch("/changes");
}

export async function getChange(id: string) {
  return apiFetch(`/changes/${id}`);
}

export async function createChange(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) { redirect("/changes"); return; }

  await apiFetch("/changes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      description: str(formData, "description"),
      changeType: String(formData.get("changeType") ?? "STANDARD"),
      priority: String(formData.get("priority") ?? "MEDIUM"),
      assetId: str(formData, "assetId") || undefined,
      justification: str(formData, "justification"),
      plannedStart: str(formData, "plannedStart"),
      plannedEnd: str(formData, "plannedEnd"),
      requestedBy: str(formData, "requestedBy"),
    }),
  });

  revalidatePath("/changes");
  revalidatePath("/dashboard");
}

export async function updateChange(id: string, data: Record<string, any>) {
  "use server";
  await apiFetch(`/changes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  revalidatePath(`/changes/${id}`);
  revalidatePath("/changes");
  revalidatePath("/dashboard");
}

export async function deleteChange(id: string) {
  "use server";
  await apiFetch(`/changes/${id}`, { method: "DELETE" });
  revalidatePath("/changes");
  revalidatePath("/dashboard");
}

// ========== Non-Conformities ==========
export async function getNonConformities() {
  return apiFetch("/nonconformities");
}

export async function getNonConformity(id: string) {
  return apiFetch(`/nonconformities/${id}`);
}

export async function createNonConformity(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) { redirect("/nonconformities"); return; }

  await apiFetch("/nonconformities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      description: str(formData, "description"),
      sourceType: String(formData.get("sourceType") ?? "INTERNAL"),
      category: str(formData, "category"),
      severity: String(formData.get("severity") ?? "MINOR"),
      assetId: str(formData, "assetId") || undefined,
      raisedBy: str(formData, "raisedBy"),
      assignedTo: str(formData, "assignedTo"),
      dueDate: str(formData, "dueDate"),
    }),
  });

  revalidatePath("/nonconformities");
  revalidatePath("/dashboard");
}

export async function updateNonConformity(id: string, data: Record<string, any>) {
  "use server";
  await apiFetch(`/nonconformities/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  revalidatePath(`/nonconformities/${id}`);
  revalidatePath("/nonconformities");
  revalidatePath("/dashboard");
}

export async function deleteNonConformity(id: string) {
  "use server";
  await apiFetch(`/nonconformities/${id}`, { method: "DELETE" });
  revalidatePath("/nonconformities");
  revalidatePath("/dashboard");
}

// ========== CAPAs ==========
export async function getCAPAs() {
  return apiFetch("/capas");
}

export async function getCAPA(id: string) {
  return apiFetch(`/capas/${id}`);
}

export async function createCAPA(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) { redirect("/capas"); return; }

  await apiFetch("/capas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      description: str(formData, "description"),
      capaType: String(formData.get("capaType") ?? "CORRECTIVE"),
      sourceType: str(formData, "sourceType") || undefined,
      rootCauseCategory: str(formData, "rootCauseCategory") || undefined,
      analysisMethod: str(formData, "analysisMethod") || undefined,
      priority: String(formData.get("priority") ?? "MEDIUM"),
      assetId: str(formData, "assetId") || undefined,
      actionPlan: str(formData, "actionPlan"),
      raisedBy: str(formData, "raisedBy"),
      assignedTo: str(formData, "assignedTo"),
      dueDate: str(formData, "dueDate"),
    }),
  });

  revalidatePath("/capas");
  revalidatePath("/dashboard");
}

export async function updateCAPA(id: string, data: Record<string, any>) {
  "use server";
  await apiFetch(`/capas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  revalidatePath(`/capas/${id}`);
  revalidatePath("/capas");
  revalidatePath("/dashboard");
}

export async function deleteCAPA(id: string) {
  "use server";
  await apiFetch(`/capas/${id}`, { method: "DELETE" });
  revalidatePath("/capas");
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
      Authorization: `Bearer ${dbUser.token}`,
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
      Authorization: `Bearer ${dbUser.token}`,
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

// ========== Cross-Links (entity-specific) ==========
export async function getEntityCrossLinks(entityType: string, entityId: string) {
  return apiFetch(`/cross-links/${entityType}/${entityId}`);
}

// ========== Phase E: Enhanced Dashboard & Cross-Links ==========

export async function getEnhancedDashboard() {
  return apiFetch("/dashboard/enhanced");
}

export async function getCrossLinks() {
  return apiFetch("/cross-links");
}

export async function createCrossLink(data: {
  sourceType: string;
  sourceId: string;
  sourceTitle?: string;
  targetType: string;
  targetId: string;
  targetTitle?: string;
}) {
  "use server";
  await apiFetch("/cross-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  revalidatePath("/dashboard");
}

export async function deleteCrossLink(id: string) {
  "use server";
  await apiFetch(`/cross-links/${id}`, { method: "DELETE" });
  revalidatePath("/dashboard");
}

// ========== Account & Team Management ==========
export async function getAccount() {
  return apiFetch("/account");
}

export async function updateAccount(data: { name?: string; primaryColor?: string; exportAllowedRoles?: string[] }) {
  "use server";
  await apiFetch("/account", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  revalidatePath("/account");
}

export async function uploadOrgLogo(formData: FormData) {
  "use server";
  const dbUser = await getDbUser();
  const res = await fetch(`${API_BASE}/account/logo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dbUser.token}`,
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to upload logo");
  }
  revalidatePath("/account");
  return res.json();
}

export async function getMembers() {
  return apiFetch("/account/members");
}

export async function updateMemberRole(memberId: string, role: string) {
  "use server";
  await apiFetch(`/account/members/${memberId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  revalidatePath("/account");
}

export async function removeMember(memberId: string) {
  "use server";
  await apiFetch(`/account/members/${memberId}`, { method: "DELETE" });
  revalidatePath("/account");
}

export async function inviteMember(data: { email: string; role: string; fullName?: string }) {
  "use server";
  await apiFetch("/account/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  revalidatePath("/account");
}

export async function getCurrentRole(): Promise<string> {
  const dbUser = await getDbUser();
  return dbUser.role;
}

export async function changePassword(data: { currentPassword: string; newPassword: string }) {
  "use server";
  const res = await apiFetch("/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to change password");
  }
}

// Approvals
export async function getApprovals(status?: string) {
  const params = status ? `?status=${status}` : "";
  return apiFetch(`/approvals${params}`);
}
export async function getPendingApprovalCount() {
  return apiFetch("/approvals/pending/count");
}
export async function submitForApproval(entityType: string, entityId: string) {
  return apiFetch("/approvals/submit", { method: "POST", body: JSON.stringify({ entityType, entityId }) });
}
export async function decideApproval(approvalId: string, decision: "APPROVED" | "REJECTED", comment?: string) {
  return apiFetch(`/approvals/${approvalId}/decide`, { method: "POST", body: JSON.stringify({ decision, comment }) });
}
export async function getApprovalHistory(entityType: string, entityId: string) {
  return apiFetch(`/approvals/history/${entityType}/${entityId}`);
}

// Documents
export async function getDocuments() { return apiFetch("/documents"); }
export async function getDocument(id: string) { return apiFetch(`/documents/${id}`); }
export async function createDocument(data: any) { return apiFetch("/documents", { method: "POST", body: JSON.stringify(data) }); }
export async function updateDocument(id: string, data: any) { return apiFetch(`/documents/${id}`, { method: "PUT", body: JSON.stringify(data) }); }
export async function deleteDocument(id: string) { return apiFetch(`/documents/${id}`, { method: "DELETE" }); }
export async function getDocumentVersions(id: string) { return apiFetch(`/documents/${id}/versions`); }
export async function uploadDocumentVersion(docId: string, file: File, versionLabel: string, changeNotes?: string) {
  const dbUser = await getDbUser();
  const formData = new FormData();
  formData.append("file", file);
  const params = new URLSearchParams();
  params.set("versionLabel", versionLabel);
  if (changeNotes) params.set("changeNotes", changeNotes);
  const res = await fetch(`${API_BASE}/documents/${docId}/versions?${params.toString()}`, {
    method: "POST",
    body: formData,
    headers: {
      Authorization: `Bearer ${dbUser.token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
}

// ========== Session Management ==========
export async function getSessions() {
  return apiFetch("/account/sessions");
}

export async function revokeSession(id: string) {
  return apiFetch(`/account/sessions/${id}`, { method: "DELETE" });
}

export async function revokeAllSessions() {
  return apiFetch("/account/sessions/revoke-all", { method: "POST" });
}

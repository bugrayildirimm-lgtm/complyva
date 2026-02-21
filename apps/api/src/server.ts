import "dotenv/config";
import Fastify from "fastify";
import { z } from "zod";
import { pool } from "./db";
import { getAuth } from "./auth";
import multipart from "@fastify/multipart";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { runAllAlerts, sendWeeklyDigest } from "./emails";
import { logActivity } from "./activity";

const app = Fastify({ logger: true });
app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });

const UPLOAD_DIR = join(process.cwd(), "uploads");
mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {});

function cleanBody(body: any) {
  if (!body || typeof body !== "object") return body;
  const cleaned = { ...body };
  for (const key of Object.keys(cleaned)) {
    if (cleaned[key] === "" || cleaned[key] === null || cleaned[key] === undefined) {
      delete cleaned[key];
    }
  }
  return cleaned;
}

// --- Basic routes ---
app.get("/", async () => ({
  ok: true,
  routes: [
    "/health",
    "/debug/tables",
    "/dashboard/summary",
    "/certifications (GET, POST, PUT, DELETE)",
    "/risks (GET, POST, PUT, DELETE)",
    "/audits (GET, POST, PUT, DELETE)",
    "/findings (GET, POST, PUT, DELETE)",
    "/evidence (GET, POST, DELETE)",
    "/alerts/run (POST)",
    "/alerts/digest (POST)",
    "/assets (GET, POST, PUT, DELETE)",
    "/incidents (GET, POST, PUT, DELETE)",
    "/changes (GET, POST, PUT, DELETE)",
    "/nonconformities (GET, POST, PUT, DELETE)",
    "/capas (GET, POST, PUT, DELETE)",
    "/activity (GET)",
  ],
}));

app.get("/health", async () => ({ ok: true }));

app.get("/debug/tables", async () => {
  const r = await pool.query(`
    select tablename from pg_tables
    where schemaname = 'public' order by tablename;
  `);
  return r.rows;
});

// --- Dashboard summary ---
app.get("/dashboard/summary", async (req) => {
  const { orgId } = getAuth(req);

  const expiringSoon = await pool.query(
    `select count(*)::int as count from certifications
     where org_id = $1 and expiry_date is not null
       and expiry_date <= (current_date + interval '60 days') and status = 'ACTIVE'`,
    [orgId]
  );
  const openRisks = await pool.query(
    `select count(*)::int as count from risks
     where org_id = $1 and status in ('OPEN','IN_TREATMENT')`,
    [orgId]
  );
  const openFindings = await pool.query(
    `select count(*)::int as count from audit_findings
     where org_id = $1 and status in ('OPEN','IN_PROGRESS')`,
    [orgId]
  );
  const activeAudits = await pool.query(
    `select count(*)::int as count from audits
     where org_id = $1 and status = 'IN_PROGRESS'`,
    [orgId]
  );
  const recentRisks = await pool.query(
    `select id, title, category, likelihood, impact, inherent_score, status
     from risks where org_id = $1 order by created_at desc limit 5`,
    [orgId]
  );
  const upcomingAudits = await pool.query(
    `select id, title, type, status, start_date
     from audits where org_id = $1 order by created_at desc limit 5`,
    [orgId]
  );

  return {
    expiringSoon: expiringSoon.rows[0]?.count ?? 0,
    openRisks: openRisks.rows[0]?.count ?? 0,
    openFindings: openFindings.rows[0]?.count ?? 0,
    activeAudits: activeAudits.rows[0]?.count ?? 0,
    recentRisks: recentRisks.rows,
    upcomingAudits: upcomingAudits.rows,
  };
});

// =======================
// Certifications
// =======================
const CertificationSchema = z.object({
  name: z.string().min(2).max(200),
  frameworkType: z.string().max(200).optional(),
  issuingBody: z.string().max(200).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "REVOKED", "SUSPENDED"]).optional(),
  notes: z.string().max(5000).optional(),
});

app.get("/certifications", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `select * from certifications where org_id = $1 order by created_at desc limit 200`,
    [orgId]
  );
  return r.rows;
});

app.get("/certifications/:id", async (req) => {
  const { orgId } = getAuth(req);
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `select * from certifications where id = $1 and org_id = $2`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  return r.rows[0];
});

app.post("/certifications", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const p = CertificationSchema.parse(cleanBody(req.body));
  const r = await pool.query(
    `insert into certifications (org_id, name, framework_type, issuing_body, issue_date, expiry_date, owner_user_id, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [orgId, p.name, p.frameworkType ?? null, p.issuingBody ?? null, p.issueDate ?? null, p.expiryDate ?? null, userId, p.notes ?? null]
  );
  await logActivity(orgId, userId, "CREATED", "CERTIFICATION", r.rows[0].id, p.name);
  return r.rows[0];
});

app.put("/certifications/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const p = CertificationSchema.partial().parse(cleanBody(req.body));
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (p.name !== undefined) { fields.push(`name = $${idx++}`); values.push(p.name); }
  if (p.frameworkType !== undefined) { fields.push(`framework_type = $${idx++}`); values.push(p.frameworkType); }
  if (p.issuingBody !== undefined) { fields.push(`issuing_body = $${idx++}`); values.push(p.issuingBody); }
  if (p.issueDate !== undefined) { fields.push(`issue_date = $${idx++}`); values.push(p.issueDate); }
  if (p.expiryDate !== undefined) { fields.push(`expiry_date = $${idx++}`); values.push(p.expiryDate); }
  if (p.status !== undefined) { fields.push(`status = $${idx++}`); values.push(p.status); }
  if (p.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(p.notes); }

  if (fields.length === 0) throw new Error("No fields to update");
  values.push(id, orgId);

  const r = await pool.query(
    `update certifications set ${fields.join(", ")} where id = $${idx++} and org_id = $${idx} returning *`,
    values
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "UPDATED", "CERTIFICATION", id, r.rows[0].name, `Fields: ${Object.keys(p).join(", ")}`);
  return r.rows[0];
});

app.delete("/certifications/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `delete from certifications where id = $1 and org_id = $2 returning *`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "DELETED", "CERTIFICATION", id, r.rows[0].name);
  return { deleted: true };
});

// =======================
// Risks
// =======================
const RiskSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().max(200).optional(),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  frequency: z.number().int().min(1).max(4).optional(),
  controlEffectiveness: z.number().int().min(1).max(4).optional(),
  residualLikelihood: z.number().int().min(1).max(5).optional(),
  residualImpact: z.number().int().min(1).max(5).optional(),
  status: z.enum(["PENDING_REVIEW", "OPEN", "IN_TREATMENT", "ACCEPTED", "CLOSED", "REJECTED"]).optional(),
  treatmentPlan: z.string().max(5000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sourceType: z.enum(["MANUAL", "FINDING", "NON_CONFORMITY", "INCIDENT"]).optional(),
  sourceId: z.string().uuid().optional(),
});

app.get("/risks", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `select * from risks where org_id = $1 order by created_at desc limit 200`,
    [orgId]
  );
  return r.rows;
});

app.get("/risks/:id", async (req) => {
  const { orgId } = getAuth(req);
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `select * from risks where id = $1 and org_id = $2`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  return r.rows[0];
});

app.post("/risks", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const p = RiskSchema.parse(cleanBody(req.body));
  const inherentScore = p.likelihood * p.impact;
  const residualScore = (p.residualLikelihood && p.residualImpact) ? p.residualLikelihood * p.residualImpact : null;
  const r = await pool.query(
    `insert into risks
      (org_id, title, description, category, likelihood, impact, frequency, control_effectiveness,
       inherent_score, residual_likelihood, residual_impact, residual_score,
       status, owner_user_id, treatment_plan, due_date)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning *`,
    [orgId, p.title, p.description ?? null, p.category ?? null,
     p.likelihood, p.impact, p.frequency ?? null, p.controlEffectiveness ?? null,
     inherentScore, p.residualLikelihood ?? null, p.residualImpact ?? null, residualScore,
     p.status ?? "OPEN", userId, p.treatmentPlan ?? null, p.dueDate ?? null]
  );
  await logActivity(orgId, userId, "CREATED", "RISK", r.rows[0].id, p.title, `Score: ${inherentScore}`);
  return r.rows[0];
});

app.put("/risks/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const p = RiskSchema.partial().parse(cleanBody(req.body));
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (p.title !== undefined) { fields.push(`title = $${idx++}`); values.push(p.title); }
  if (p.description !== undefined) { fields.push(`description = $${idx++}`); values.push(p.description); }
  if (p.category !== undefined) { fields.push(`category = $${idx++}`); values.push(p.category); }
  if (p.likelihood !== undefined) { fields.push(`likelihood = $${idx++}`); values.push(p.likelihood); }
  if (p.impact !== undefined) { fields.push(`impact = $${idx++}`); values.push(p.impact); }
  if (p.frequency !== undefined) { fields.push(`frequency = $${idx++}`); values.push(p.frequency); }
  if (p.controlEffectiveness !== undefined) { fields.push(`control_effectiveness = $${idx++}`); values.push(p.controlEffectiveness); }
  if (p.residualLikelihood !== undefined) { fields.push(`residual_likelihood = $${idx++}`); values.push(p.residualLikelihood); }
  if (p.residualImpact !== undefined) { fields.push(`residual_impact = $${idx++}`); values.push(p.residualImpact); }
  // Auto-calculate scores when components change
  if (p.likelihood !== undefined || p.impact !== undefined) {
    // Need to fetch current values to compute
    const cur = await pool.query(`SELECT likelihood, impact FROM risks WHERE id = $1 AND org_id = $2`, [id, orgId]);
    if (cur.rows.length > 0) {
      const l = p.likelihood ?? cur.rows[0].likelihood;
      const i = p.impact ?? cur.rows[0].impact;
      fields.push(`inherent_score = $${idx++}`); values.push(l * i);
    }
  }
  if (p.residualLikelihood !== undefined || p.residualImpact !== undefined) {
    const cur = await pool.query(`SELECT residual_likelihood, residual_impact FROM risks WHERE id = $1 AND org_id = $2`, [id, orgId]);
    if (cur.rows.length > 0) {
      const rl = p.residualLikelihood ?? cur.rows[0].residual_likelihood;
      const ri = p.residualImpact ?? cur.rows[0].residual_impact;
      if (rl && ri) { fields.push(`residual_score = $${idx++}`); values.push(rl * ri); }
    }
  }
  if (p.status !== undefined) { fields.push(`status = $${idx++}`); values.push(p.status); }
  if (p.treatmentPlan !== undefined) { fields.push(`treatment_plan = $${idx++}`); values.push(p.treatmentPlan); }
  if (p.dueDate !== undefined) { fields.push(`due_date = $${idx++}`); values.push(p.dueDate); }

  if (fields.length === 0) throw new Error("No fields to update");
  values.push(id, orgId);

  const r = await pool.query(
    `update risks set ${fields.join(", ")} where id = $${idx++} and org_id = $${idx} returning *`,
    values
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "UPDATED", "RISK", id, r.rows[0].title, `Fields: ${Object.keys(p).join(", ")}`);
  return r.rows[0];
});

app.delete("/risks/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `delete from risks where id = $1 and org_id = $2 returning *`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "DELETED", "RISK", id, r.rows[0].title);
  return { deleted: true };
});

// =======================
// Audits
// =======================
const AuditSchema = z.object({
  type: z.enum(["INTERNAL", "EXTERNAL", "CERTIFICATION"]),
  title: z.string().min(2).max(200),
  scope: z.string().max(5000).optional(),
  auditor: z.string().max(200).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});

app.get("/audits", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `select * from audits where org_id = $1 order by created_at desc limit 200`,
    [orgId]
  );
  return r.rows;
});

app.get("/audits/:id", async (req) => {
  const { orgId } = getAuth(req);
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `select * from audits where id = $1 and org_id = $2`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  return r.rows[0];
});

app.post("/audits", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const p = AuditSchema.parse(cleanBody(req.body));
  const r = await pool.query(
    `insert into audits (org_id, type, title, scope, auditor, start_date, end_date, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [orgId, p.type, p.title, p.scope ?? null, p.auditor ?? null, p.startDate ?? null, p.endDate ?? null, p.status ?? "PLANNED"]
  );
  await logActivity(orgId, userId, "CREATED", "AUDIT", r.rows[0].id, p.title, `Type: ${p.type}`);
  return r.rows[0];
});

app.put("/audits/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const p = AuditSchema.partial().parse(cleanBody(req.body));
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (p.type !== undefined) { fields.push(`type = $${idx++}`); values.push(p.type); }
  if (p.title !== undefined) { fields.push(`title = $${idx++}`); values.push(p.title); }
  if (p.scope !== undefined) { fields.push(`scope = $${idx++}`); values.push(p.scope); }
  if (p.auditor !== undefined) { fields.push(`auditor = $${idx++}`); values.push(p.auditor); }
  if (p.startDate !== undefined) { fields.push(`start_date = $${idx++}`); values.push(p.startDate); }
  if (p.endDate !== undefined) { fields.push(`end_date = $${idx++}`); values.push(p.endDate); }
  if (p.status !== undefined) { fields.push(`status = $${idx++}`); values.push(p.status); }

  if (fields.length === 0) throw new Error("No fields to update");
  values.push(id, orgId);

  const r = await pool.query(
    `update audits set ${fields.join(", ")} where id = $${idx++} and org_id = $${idx} returning *`,
    values
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "UPDATED", "AUDIT", id, r.rows[0].title, `Fields: ${Object.keys(p).join(", ")}`);
  return r.rows[0];
});

app.delete("/audits/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `delete from audits where id = $1 and org_id = $2 returning *`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "DELETED", "AUDIT", id, r.rows[0].title);
  return { deleted: true };
});

// =======================
// Findings
// =======================
const FindingSchema = z.object({
  auditId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  recommendation: z.string().max(5000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED"]).optional(),
});

app.get("/audits/:id/findings", async (req) => {
  const { orgId } = getAuth(req);
  const auditId = (req.params as any).id as string;
  const r = await pool.query(
    `select * from audit_findings where org_id = $1 and audit_id = $2 order by created_at desc`,
    [orgId, auditId]
  );
  return r.rows;
});

app.get("/findings/:id", async (req) => {
  const { orgId } = getAuth(req);
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `select * from audit_findings where id = $1 and org_id = $2`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  return r.rows[0];
});

app.post("/findings", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const p = FindingSchema.parse(cleanBody(req.body));
  const r = await pool.query(
    `insert into audit_findings
      (org_id, audit_id, title, description, severity, recommendation, owner_user_id, due_date, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [orgId, p.auditId, p.title, p.description ?? null, p.severity, p.recommendation ?? null, userId, p.dueDate ?? null, p.status ?? "OPEN"]
  );
  await logActivity(orgId, userId, "CREATED", "FINDING", r.rows[0].id, p.title, `Severity: ${p.severity}`);
  return r.rows[0];
});

app.put("/findings/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const p = FindingSchema.partial().parse(cleanBody(req.body));
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (p.title !== undefined) { fields.push(`title = $${idx++}`); values.push(p.title); }
  if (p.description !== undefined) { fields.push(`description = $${idx++}`); values.push(p.description); }
  if (p.severity !== undefined) { fields.push(`severity = $${idx++}`); values.push(p.severity); }
  if (p.recommendation !== undefined) { fields.push(`recommendation = $${idx++}`); values.push(p.recommendation); }
  if (p.dueDate !== undefined) { fields.push(`due_date = $${idx++}`); values.push(p.dueDate); }
  if (p.status !== undefined) { fields.push(`status = $${idx++}`); values.push(p.status); }

  if (fields.length === 0) throw new Error("No fields to update");
  values.push(id, orgId);

  const r = await pool.query(
    `update audit_findings set ${fields.join(", ")} where id = $${idx++} and org_id = $${idx} returning *`,
    values
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "UPDATED", "FINDING", id, r.rows[0].title, `Fields: ${Object.keys(p).join(", ")}`);
  return r.rows[0];
});

app.delete("/findings/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `delete from audit_findings where id = $1 and org_id = $2 returning *`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "DELETED", "FINDING", id, r.rows[0].title);
  return { deleted: true };
});

// Send finding to risk register
app.post("/findings/:id/send-to-risk", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };

  // Get the finding
  const f = await pool.query(
    `select * from audit_findings where id = $1 and org_id = $2`,
    [id, orgId]
  );
  if (f.rows.length === 0) throw new Error("Finding not found");
  const finding = f.rows[0];

  // Map severity to likelihood/impact
  const severityMap: Record<string, number> = { LOW: 2, MEDIUM: 3, HIGH: 4, CRITICAL: 5 };
  const score = severityMap[finding.severity] ?? 3;

  // Create risk with PENDING_REVIEW status
  const r = await pool.query(
    `insert into risks
      (org_id, title, description, category, likelihood, impact, status, owner_user_id, treatment_plan)
     values ($1, $2, $3, $4, $5, $6, 'PENDING_REVIEW', $7, $8) returning *`,
    [
      orgId,
      `[From Finding] ${finding.title}`,
      finding.description || `Originated from audit finding: ${finding.title}`,
      "Audit Finding",
      score, score,
      userId,
      finding.recommendation || null,
    ]
  );

  await logActivity(orgId, userId, "SENT_TO_RISK", "FINDING", id, finding.title, `Created Risk: ${r.rows[0].id}`);
  return r.rows[0];
});

// =======================
// Auth Sync (Clerk → DB)
// =======================
app.post("/auth/sync", async (req) => {
  const clerkUserId = String(req.headers["x-clerk-user-id"] ?? "");
  const email = String(req.headers["x-clerk-email"] ?? "");
  const fullName = String(req.headers["x-clerk-name"] ?? "");

  if (!clerkUserId || !email) throw new Error("Missing clerk user info");

  const existing = await pool.query(
    `SELECT u.id as user_id, m.org_id, m.role
     FROM users u JOIN memberships m ON m.user_id = u.id
     WHERE u.cognito_sub = $1 LIMIT 1`,
    [clerkUserId]
  );

  if (existing.rows.length > 0) {
    return { userId: existing.rows[0].user_id, orgId: existing.rows[0].org_id, role: existing.rows[0].role };
  }

  const orgResult = await pool.query(
    `INSERT INTO organisations (name) VALUES ($1) RETURNING id`,
    [`${fullName || email}'s Organisation`]
  );
  const orgId = orgResult.rows[0].id;

  const userResult = await pool.query(
    `INSERT INTO users (email, full_name, cognito_sub) VALUES ($1, $2, $3) RETURNING id`,
    [email, fullName || null, clerkUserId]
  );
  const userId = userResult.rows[0].id;

  await pool.query(
    `INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'ADMIN')`,
    [orgId, userId]
  );

  await logActivity(orgId, userId, "SIGNED_UP", "USER", userId, fullName || email);
  return { userId, orgId, role: "ADMIN" };
});

// =======================
// Evidence Files
// =======================
app.post("/evidence/upload", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");

  const query = req.query as { entityType?: string; entityId?: string };
  const entityType = query.entityType ?? "";
  const entityId = query.entityId ?? "";

  if (!["CERTIFICATION", "RISK", "AUDIT", "FINDING"].includes(entityType)) throw new Error("Invalid entity type");
  if (!entityId) throw new Error("Missing entity ID");

  const data = await req.file();
  if (!data) throw new Error("No file uploaded");

  const buffer = await data.toBuffer();
  const fileName = data.filename;
  const mimeType = data.mimetype;
  const fileSize = buffer.length;
  const storageKey = `${orgId}/${entityType}/${entityId}/${Date.now()}-${fileName}`;
  const filePath = join(UPLOAD_DIR, storageKey);

  await mkdir(join(UPLOAD_DIR, orgId, entityType, entityId), { recursive: true });
  await writeFile(filePath, buffer);

  const r = await pool.query(
    `INSERT INTO evidence_files (org_id, entity_type, entity_id, file_name, mime_type, file_size, s3_key, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [orgId, entityType, entityId, fileName, mimeType, fileSize, storageKey, userId]
  );
  await logActivity(orgId, userId, "UPLOADED", "EVIDENCE", r.rows[0].id, fileName, `For ${entityType} ${entityId}`);
  return r.rows[0];
});

app.get("/evidence/:entityType/:entityId", async (req) => {
  const { orgId } = getAuth(req);
  const { entityType, entityId } = req.params as { entityType: string; entityId: string };
  const r = await pool.query(
    `SELECT id, file_name, mime_type, file_size, uploaded_at
     FROM evidence_files WHERE org_id = $1 AND entity_type = $2 AND entity_id = $3
     ORDER BY uploaded_at DESC`,
    [orgId, entityType.toUpperCase(), entityId]
  );
  return r.rows;
});

app.get("/evidence/download/:fileId", async (req, reply) => {
  const { orgId } = getAuth(req);
  const { fileId } = req.params as { fileId: string };
  const r = await pool.query(
    `SELECT * FROM evidence_files WHERE id = $1 AND org_id = $2`,
    [fileId, orgId]
  );
  if (r.rows.length === 0) throw new Error("File not found");
  const file = r.rows[0];
  const filePath = join(UPLOAD_DIR, file.s3_key);
  const buffer = await readFile(filePath);
  reply
    .header("Content-Type", file.mime_type || "application/octet-stream")
    .header("Content-Disposition", `attachment; filename="${file.file_name}"`)
    .send(buffer);
});

app.delete("/evidence/:fileId", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { fileId } = req.params as { fileId: string };
  const r = await pool.query(
    `DELETE FROM evidence_files WHERE id = $1 AND org_id = $2 RETURNING *`,
    [fileId, orgId]
  );
  if (r.rows.length === 0) throw new Error("File not found");
  await logActivity(orgId, userId, "DELETED", "EVIDENCE", fileId, r.rows[0].file_name);
  return { deleted: true };
});

// =======================
// Activity Log
// =======================
app.get("/activity", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `SELECT a.*, u.full_name, u.email
     FROM activity_log a LEFT JOIN users u ON u.id = a.actor_user_id
     WHERE a.org_id = $1 ORDER BY a.created_at DESC LIMIT 100`,
    [orgId]
  );
  return r.rows;
});

// Entity-specific activity
app.get("/activity/:entityType/:entityId", async (req) => {
  const { orgId } = getAuth(req);
  const { entityType, entityId } = req.params as { entityType: string; entityId: string };
  const r = await pool.query(
    `SELECT a.*, u.full_name, u.email
     FROM activity_log a LEFT JOIN users u ON u.id = a.actor_user_id
     WHERE a.org_id = $1 AND a.entity_type = $2 AND a.entity_id = $3
     ORDER BY a.created_at DESC LIMIT 50`,
    [orgId, entityType.toUpperCase(), entityId]
  );
  return r.rows;
});

// =======================
// Assets
// =======================
const AssetSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().max(200).optional(),
  assetType: z.enum(["PRODUCT", "SYSTEM", "STUDIO", "DATA", "PEOPLE", "FACILITY"]),
  owner: z.string().max(200).optional(),
  biaScore: z.number().int().min(1).max(4).optional(),
  dcaScore: z.number().int().min(1).max(4).optional(),
  status: z.enum(["ACTIVE", "UNDER_REVIEW", "DECOMMISSIONED"]).optional(),
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(5000).optional(),
});

app.get("/assets", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `SELECT * FROM assets WHERE org_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [orgId]
  );
  return r.rows;
});

app.get("/assets/:id", async (req) => {
  const { orgId } = getAuth(req);
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `SELECT * FROM assets WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  return r.rows[0];
});

app.post("/assets", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const p = AssetSchema.parse(cleanBody(req.body));
  const r = await pool.query(
    `INSERT INTO assets (org_id, name, description, category, asset_type, owner, bia_score, dca_score, status, review_date, notes, owner_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [orgId, p.name, p.description ?? null, p.category ?? null, p.assetType, p.owner ?? null,
     p.biaScore ?? null, p.dcaScore ?? null, p.status ?? "ACTIVE", p.reviewDate ?? null, p.notes ?? null, userId]
  );
  await logActivity(orgId, userId, "CREATED", "ASSET", r.rows[0].id, p.name, `Type: ${p.assetType}`);
  return r.rows[0];
});

app.put("/assets/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const p = AssetSchema.partial().parse(cleanBody(req.body));
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (p.name !== undefined) { fields.push(`name = $${idx++}`); values.push(p.name); }
  if (p.description !== undefined) { fields.push(`description = $${idx++}`); values.push(p.description); }
  if (p.category !== undefined) { fields.push(`category = $${idx++}`); values.push(p.category); }
  if (p.assetType !== undefined) { fields.push(`asset_type = $${idx++}`); values.push(p.assetType); }
  if (p.owner !== undefined) { fields.push(`owner = $${idx++}`); values.push(p.owner); }
  if (p.biaScore !== undefined) { fields.push(`bia_score = $${idx++}`); values.push(p.biaScore); }
  if (p.dcaScore !== undefined) { fields.push(`dca_score = $${idx++}`); values.push(p.dcaScore); }
  if (p.status !== undefined) { fields.push(`status = $${idx++}`); values.push(p.status); }
  if (p.reviewDate !== undefined) { fields.push(`review_date = $${idx++}`); values.push(p.reviewDate); }
  if (p.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(p.notes); }

  if (fields.length === 0) throw new Error("No fields to update");
  values.push(id, orgId);

  const r = await pool.query(
    `UPDATE assets SET ${fields.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
    values
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "UPDATED", "ASSET", id, r.rows[0].name, `Fields: ${Object.keys(p).join(", ")}`);
  return r.rows[0];
});

app.delete("/assets/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `DELETE FROM assets WHERE id = $1 AND org_id = $2 RETURNING *`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "DELETED", "ASSET", id, r.rows[0].name);
  return { deleted: true };
});

// =======================
// Incidents
// =======================
const IncidentSchema = z.object({
  title: z.string().min(2).max(300),
  description: z.string().max(5000).optional(),
  incidentDate: z.string().optional(),
  detectedDate: z.string().optional(),
  category: z.string().max(100).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assetId: z.string().uuid().optional(),
  rootCause: z.string().max(5000).optional(),
  immediateAction: z.string().max(5000).optional(),
  correctiveAction: z.string().max(5000).optional(),
  reportedBy: z.string().max(200).optional(),
  assignedTo: z.string().max(200).optional(),
  status: z.enum(["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"]).optional(),
  resolvedDate: z.string().optional(),
});

app.get("/incidents", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `SELECT i.*, a.name as asset_name FROM incidents i LEFT JOIN assets a ON a.id = i.asset_id WHERE i.org_id = $1 ORDER BY i.created_at DESC LIMIT 200`,
    [orgId]
  );
  return r.rows;
});

app.get("/incidents/:id", async (req) => {
  const { orgId } = getAuth(req);
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `SELECT i.*, a.name as asset_name FROM incidents i LEFT JOIN assets a ON a.id = i.asset_id WHERE i.id = $1 AND i.org_id = $2`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  return r.rows[0];
});

app.post("/incidents", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const p = IncidentSchema.parse(cleanBody(req.body));
  const r = await pool.query(
    `INSERT INTO incidents (org_id, title, description, incident_date, detected_date, category, severity, asset_id, root_cause, immediate_action, corrective_action, reported_by, assigned_to, status, owner_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [orgId, p.title, p.description ?? null, p.incidentDate ?? null, p.detectedDate ?? null,
     p.category ?? null, p.severity ?? "MEDIUM", p.assetId ?? null,
     p.rootCause ?? null, p.immediateAction ?? null, p.correctiveAction ?? null,
     p.reportedBy ?? null, p.assignedTo ?? null, p.status ?? "OPEN", userId]
  );
  await logActivity(orgId, userId, "CREATED", "INCIDENT", r.rows[0].id, p.title, `Severity: ${p.severity ?? "MEDIUM"}`);
  return r.rows[0];
});

app.put("/incidents/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const p = IncidentSchema.partial().parse(cleanBody(req.body));
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (p.title !== undefined) { fields.push(`title = $${idx++}`); values.push(p.title); }
  if (p.description !== undefined) { fields.push(`description = $${idx++}`); values.push(p.description); }
  if (p.incidentDate !== undefined) { fields.push(`incident_date = $${idx++}`); values.push(p.incidentDate); }
  if (p.detectedDate !== undefined) { fields.push(`detected_date = $${idx++}`); values.push(p.detectedDate); }
  if (p.category !== undefined) { fields.push(`category = $${idx++}`); values.push(p.category); }
  if (p.severity !== undefined) { fields.push(`severity = $${idx++}`); values.push(p.severity); }
  if (p.assetId !== undefined) { fields.push(`asset_id = $${idx++}`); values.push(p.assetId); }
  if (p.rootCause !== undefined) { fields.push(`root_cause = $${idx++}`); values.push(p.rootCause); }
  if (p.immediateAction !== undefined) { fields.push(`immediate_action = $${idx++}`); values.push(p.immediateAction); }
  if (p.correctiveAction !== undefined) { fields.push(`corrective_action = $${idx++}`); values.push(p.correctiveAction); }
  if (p.reportedBy !== undefined) { fields.push(`reported_by = $${idx++}`); values.push(p.reportedBy); }
  if (p.assignedTo !== undefined) { fields.push(`assigned_to = $${idx++}`); values.push(p.assignedTo); }
  if (p.status !== undefined) { fields.push(`status = $${idx++}`); values.push(p.status); }
  if (p.resolvedDate !== undefined) { fields.push(`resolved_date = $${idx++}`); values.push(p.resolvedDate); }

  if (fields.length === 0) throw new Error("No fields to update");
  fields.push(`updated_at = now()`);
  values.push(id, orgId);

  const r = await pool.query(
    `UPDATE incidents SET ${fields.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
    values
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "UPDATED", "INCIDENT", id, r.rows[0].title, `Fields: ${Object.keys(p).join(", ")}`);
  return r.rows[0];
});

app.delete("/incidents/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `DELETE FROM incidents WHERE id = $1 AND org_id = $2 RETURNING *`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "DELETED", "INCIDENT", id, r.rows[0].title);
  return { deleted: true };
});

// =======================
// Changes
// =======================
const ChangeSchema = z.object({
  title: z.string().min(2).max(300),
  description: z.string().max(5000).optional(),
  changeType: z.enum(["STANDARD", "NORMAL", "EMERGENCY", "EXPEDITED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assetId: z.string().uuid().optional(),
  justification: z.string().max(5000).optional(),
  impactAnalysis: z.string().max(5000).optional(),
  rollbackPlan: z.string().max(5000).optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  actualStart: z.string().optional(),
  actualEnd: z.string().optional(),
  requestedBy: z.string().max(200).optional(),
  approvedBy: z.string().max(200).optional(),
  implementedBy: z.string().max(200).optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED", "ROLLED_BACK", "CANCELLED"]).optional(),
});

app.get("/changes", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `SELECT c.*, a.name as asset_name, a.combined_classification as asset_classification FROM changes c LEFT JOIN assets a ON a.id = c.asset_id WHERE c.org_id = $1 ORDER BY c.created_at DESC LIMIT 200`,
    [orgId]
  );
  return r.rows;
});

app.get("/changes/:id", async (req) => {
  const { orgId } = getAuth(req);
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `SELECT c.*, a.name as asset_name, a.combined_classification as asset_classification FROM changes c LEFT JOIN assets a ON a.id = c.asset_id WHERE c.id = $1 AND c.org_id = $2`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  return r.rows[0];
});

app.post("/changes", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const p = ChangeSchema.parse(cleanBody(req.body));
  const r = await pool.query(
    `INSERT INTO changes (org_id, title, description, change_type, priority, asset_id, justification, impact_analysis, rollback_plan, planned_start, planned_end, requested_by, status, owner_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [orgId, p.title, p.description ?? null, p.changeType ?? "STANDARD", p.priority ?? "MEDIUM",
     p.assetId ?? null, p.justification ?? null, p.impactAnalysis ?? null, p.rollbackPlan ?? null,
     p.plannedStart ?? null, p.plannedEnd ?? null, p.requestedBy ?? null, p.status ?? "DRAFT", userId]
  );
  await logActivity(orgId, userId, "CREATED", "CHANGE", r.rows[0].id, p.title, `Type: ${p.changeType ?? "STANDARD"}`);
  return r.rows[0];
});

app.put("/changes/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const p = ChangeSchema.partial().parse(cleanBody(req.body));
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (p.title !== undefined) { fields.push(`title = $${idx++}`); values.push(p.title); }
  if (p.description !== undefined) { fields.push(`description = $${idx++}`); values.push(p.description); }
  if (p.changeType !== undefined) { fields.push(`change_type = $${idx++}`); values.push(p.changeType); }
  if (p.priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(p.priority); }
  if (p.assetId !== undefined) { fields.push(`asset_id = $${idx++}`); values.push(p.assetId); }
  if (p.justification !== undefined) { fields.push(`justification = $${idx++}`); values.push(p.justification); }
  if (p.impactAnalysis !== undefined) { fields.push(`impact_analysis = $${idx++}`); values.push(p.impactAnalysis); }
  if (p.rollbackPlan !== undefined) { fields.push(`rollback_plan = $${idx++}`); values.push(p.rollbackPlan); }
  if (p.plannedStart !== undefined) { fields.push(`planned_start = $${idx++}`); values.push(p.plannedStart); }
  if (p.plannedEnd !== undefined) { fields.push(`planned_end = $${idx++}`); values.push(p.plannedEnd); }
  if (p.actualStart !== undefined) { fields.push(`actual_start = $${idx++}`); values.push(p.actualStart); }
  if (p.actualEnd !== undefined) { fields.push(`actual_end = $${idx++}`); values.push(p.actualEnd); }
  if (p.requestedBy !== undefined) { fields.push(`requested_by = $${idx++}`); values.push(p.requestedBy); }
  if (p.approvedBy !== undefined) { fields.push(`approved_by = $${idx++}`); values.push(p.approvedBy); }
  if (p.implementedBy !== undefined) { fields.push(`implemented_by = $${idx++}`); values.push(p.implementedBy); }
  if (p.status !== undefined) { fields.push(`status = $${idx++}`); values.push(p.status); }

  if (fields.length === 0) throw new Error("No fields to update");
  fields.push(`updated_at = now()`);
  values.push(id, orgId);

  const r = await pool.query(
    `UPDATE changes SET ${fields.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
    values
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "UPDATED", "CHANGE", id, r.rows[0].title, `Fields: ${Object.keys(p).join(", ")}`);
  return r.rows[0];
});

app.delete("/changes/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `DELETE FROM changes WHERE id = $1 AND org_id = $2 RETURNING *`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "DELETED", "CHANGE", id, r.rows[0].title);
  return { deleted: true };
});

// =======================
// Non-Conformities
// =======================
const NCSchema = z.object({
  title: z.string().min(2).max(300),
  description: z.string().max(5000).optional(),
  sourceType: z.enum(["AUDIT", "INCIDENT", "CUSTOMER_COMPLAINT", "INTERNAL", "REGULATORY", "SUPPLIER"]).optional(),
  sourceRefId: z.string().uuid().optional(),
  category: z.string().max(100).optional(),
  severity: z.enum(["OBSERVATION", "MINOR", "MAJOR", "CRITICAL"]).optional(),
  assetId: z.string().uuid().optional(),
  rootCause: z.string().max(5000).optional(),
  containmentAction: z.string().max(5000).optional(),
  raisedBy: z.string().max(200).optional(),
  assignedTo: z.string().max(200).optional(),
  dueDate: z.string().optional(),
  closedDate: z.string().optional(),
  status: z.enum(["OPEN", "UNDER_INVESTIGATION", "CONTAINMENT", "CORRECTIVE_ACTION", "VERIFIED", "CLOSED"]).optional(),
});

app.get("/nonconformities", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `SELECT n.*, a.name as asset_name FROM nonconformities n LEFT JOIN assets a ON a.id = n.asset_id WHERE n.org_id = $1 ORDER BY n.created_at DESC LIMIT 200`,
    [orgId]
  );
  return r.rows;
});

app.get("/nonconformities/:id", async (req) => {
  const { orgId } = getAuth(req);
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `SELECT n.*, a.name as asset_name FROM nonconformities n LEFT JOIN assets a ON a.id = n.asset_id WHERE n.id = $1 AND n.org_id = $2`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  return r.rows[0];
});

app.post("/nonconformities", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const p = NCSchema.parse(cleanBody(req.body));
  const r = await pool.query(
    `INSERT INTO nonconformities (org_id, title, description, source_type, source_ref_id, category, severity, asset_id, root_cause, containment_action, raised_by, assigned_to, due_date, status, owner_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [orgId, p.title, p.description ?? null, p.sourceType ?? "INTERNAL", p.sourceRefId ?? null,
     p.category ?? null, p.severity ?? "MINOR", p.assetId ?? null,
     p.rootCause ?? null, p.containmentAction ?? null,
     p.raisedBy ?? null, p.assignedTo ?? null, p.dueDate ?? null, p.status ?? "OPEN", userId]
  );
  await logActivity(orgId, userId, "CREATED", "NC", r.rows[0].id, p.title, `Severity: ${p.severity ?? "MINOR"}`);
  return r.rows[0];
});

app.put("/nonconformities/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const p = NCSchema.partial().parse(cleanBody(req.body));
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (p.title !== undefined) { fields.push(`title = $${idx++}`); values.push(p.title); }
  if (p.description !== undefined) { fields.push(`description = $${idx++}`); values.push(p.description); }
  if (p.sourceType !== undefined) { fields.push(`source_type = $${idx++}`); values.push(p.sourceType); }
  if (p.sourceRefId !== undefined) { fields.push(`source_ref_id = $${idx++}`); values.push(p.sourceRefId); }
  if (p.category !== undefined) { fields.push(`category = $${idx++}`); values.push(p.category); }
  if (p.severity !== undefined) { fields.push(`severity = $${idx++}`); values.push(p.severity); }
  if (p.assetId !== undefined) { fields.push(`asset_id = $${idx++}`); values.push(p.assetId); }
  if (p.rootCause !== undefined) { fields.push(`root_cause = $${idx++}`); values.push(p.rootCause); }
  if (p.containmentAction !== undefined) { fields.push(`containment_action = $${idx++}`); values.push(p.containmentAction); }
  if (p.raisedBy !== undefined) { fields.push(`raised_by = $${idx++}`); values.push(p.raisedBy); }
  if (p.assignedTo !== undefined) { fields.push(`assigned_to = $${idx++}`); values.push(p.assignedTo); }
  if (p.dueDate !== undefined) { fields.push(`due_date = $${idx++}`); values.push(p.dueDate); }
  if (p.closedDate !== undefined) { fields.push(`closed_date = $${idx++}`); values.push(p.closedDate); }
  if (p.status !== undefined) { fields.push(`status = $${idx++}`); values.push(p.status); }

  if (fields.length === 0) throw new Error("No fields to update");
  fields.push(`updated_at = now()`);
  values.push(id, orgId);

  const r = await pool.query(
    `UPDATE nonconformities SET ${fields.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
    values
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "UPDATED", "NC", id, r.rows[0].title, `Fields: ${Object.keys(p).join(", ")}`);
  return r.rows[0];
});

app.delete("/nonconformities/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `DELETE FROM nonconformities WHERE id = $1 AND org_id = $2 RETURNING *`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "DELETED", "NC", id, r.rows[0].title);
  return { deleted: true };
});

// =======================
// CAPAs
// =======================
const CAPASchema = z.object({
  title: z.string().min(2).max(300),
  description: z.string().max(5000).optional(),
  capaType: z.enum(["CORRECTIVE", "PREVENTIVE", "CORRECTION"]).optional(),
  sourceType: z.string().max(50).optional(),
  sourceRefId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  rootCause: z.string().max(5000).optional(),
  rootCauseCategory: z.enum(["PEOPLE", "PROCESS", "TECHNOLOGY", "THIRD_PARTY", "EXTERNAL_REGULATORY"]).optional(),
  analysisMethod: z.enum(["FIVE_WHYS", "FISHBONE", "FAULT_TREE", "TREND_ANALYSIS"]).optional(),
  actionPlan: z.string().max(5000).optional(),
  verificationMethod: z.string().max(5000).optional(),
  effectivenessReview: z.string().max(5000).optional(),
  effectivenessStatus: z.enum(["EFFECTIVE", "PARTIALLY_EFFECTIVE", "NOT_EFFECTIVE"]).optional(),
  raisedBy: z.string().max(200).optional(),
  assignedTo: z.string().max(200).optional(),
  verifiedBy: z.string().max(200).optional(),
  closureApprovedBy: z.string().max(200).optional(),
  closureComments: z.string().max(5000).optional(),
  dueDate: z.string().optional(),
  completedDate: z.string().optional(),
  verifiedDate: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["OPEN", "UNDER_INVESTIGATION", "ACTION_DEFINED", "IN_PROGRESS", "PENDING_VERIFICATION", "CLOSED", "REOPENED"]).optional(),
});

app.get("/capas", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `SELECT c.*, a.name as asset_name FROM capas c LEFT JOIN assets a ON a.id = c.asset_id WHERE c.org_id = $1 ORDER BY c.created_at DESC LIMIT 200`,
    [orgId]
  );
  return r.rows;
});

app.get("/capas/:id", async (req) => {
  const { orgId } = getAuth(req);
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `SELECT c.*, a.name as asset_name FROM capas c LEFT JOIN assets a ON a.id = c.asset_id WHERE c.id = $1 AND c.org_id = $2`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  return r.rows[0];
});

app.post("/capas", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const p = CAPASchema.parse(cleanBody(req.body));
  const r = await pool.query(
    `INSERT INTO capas (org_id, title, description, capa_type, source_type, source_ref_id, asset_id, root_cause, root_cause_category, analysis_method, action_plan, verification_method, raised_by, assigned_to, due_date, priority, status, owner_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [orgId, p.title, p.description ?? null, p.capaType ?? "CORRECTIVE",
     p.sourceType ?? null, p.sourceRefId ?? null, p.assetId ?? null,
     p.rootCause ?? null, p.rootCauseCategory ?? null, p.analysisMethod ?? null,
     p.actionPlan ?? null, p.verificationMethod ?? null,
     p.raisedBy ?? null, p.assignedTo ?? null, p.dueDate ?? null,
     p.priority ?? "MEDIUM", p.status ?? "OPEN", userId]
  );
  await logActivity(orgId, userId, "CREATED", "CAPA", r.rows[0].id, p.title, `Type: ${p.capaType ?? "CORRECTIVE"}`);
  return r.rows[0];
});

app.put("/capas/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const p = CAPASchema.partial().parse(cleanBody(req.body));
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (p.title !== undefined) { fields.push(`title = $${idx++}`); values.push(p.title); }
  if (p.description !== undefined) { fields.push(`description = $${idx++}`); values.push(p.description); }
  if (p.capaType !== undefined) { fields.push(`capa_type = $${idx++}`); values.push(p.capaType); }
  if (p.sourceType !== undefined) { fields.push(`source_type = $${idx++}`); values.push(p.sourceType); }
  if (p.sourceRefId !== undefined) { fields.push(`source_ref_id = $${idx++}`); values.push(p.sourceRefId); }
  if (p.assetId !== undefined) { fields.push(`asset_id = $${idx++}`); values.push(p.assetId); }
  if (p.rootCause !== undefined) { fields.push(`root_cause = $${idx++}`); values.push(p.rootCause); }
  if (p.rootCauseCategory !== undefined) { fields.push(`root_cause_category = $${idx++}`); values.push(p.rootCauseCategory); }
  if (p.analysisMethod !== undefined) { fields.push(`analysis_method = $${idx++}`); values.push(p.analysisMethod); }
  if (p.actionPlan !== undefined) { fields.push(`action_plan = $${idx++}`); values.push(p.actionPlan); }
  if (p.verificationMethod !== undefined) { fields.push(`verification_method = $${idx++}`); values.push(p.verificationMethod); }
  if (p.effectivenessReview !== undefined) { fields.push(`effectiveness_review = $${idx++}`); values.push(p.effectivenessReview); }
  if (p.effectivenessStatus !== undefined) { fields.push(`effectiveness_status = $${idx++}`); values.push(p.effectivenessStatus); }
  if (p.raisedBy !== undefined) { fields.push(`raised_by = $${idx++}`); values.push(p.raisedBy); }
  if (p.assignedTo !== undefined) { fields.push(`assigned_to = $${idx++}`); values.push(p.assignedTo); }
  if (p.verifiedBy !== undefined) { fields.push(`verified_by = $${idx++}`); values.push(p.verifiedBy); }
  if (p.closureApprovedBy !== undefined) { fields.push(`closure_approved_by = $${idx++}`); values.push(p.closureApprovedBy); }
  if (p.closureComments !== undefined) { fields.push(`closure_comments = $${idx++}`); values.push(p.closureComments); }
  if (p.dueDate !== undefined) { fields.push(`due_date = $${idx++}`); values.push(p.dueDate); }
  if (p.completedDate !== undefined) { fields.push(`completed_date = $${idx++}`); values.push(p.completedDate); }
  if (p.verifiedDate !== undefined) { fields.push(`verified_date = $${idx++}`); values.push(p.verifiedDate); }
  if (p.priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(p.priority); }
  if (p.status !== undefined) { fields.push(`status = $${idx++}`); values.push(p.status); }

  if (fields.length === 0) throw new Error("No fields to update");
  fields.push(`updated_at = now()`);
  values.push(id, orgId);

  const r = await pool.query(
    `UPDATE capas SET ${fields.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
    values
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "UPDATED", "CAPA", id, r.rows[0].title, `Fields: ${Object.keys(p).join(", ")}`);
  return r.rows[0];
});

app.delete("/capas/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `DELETE FROM capas WHERE id = $1 AND org_id = $2 RETURNING *`,
    [id, orgId]
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "DELETED", "CAPA", id, r.rows[0].title);
  return { deleted: true };
});

// =======================
// Email Alerts
// =======================
app.post("/alerts/run", async (req) => {
  const { role } = getAuth(req);
  if (role !== "ADMIN") throw new Error("Forbidden");
  await runAllAlerts();
  return { ok: true, message: "Alert checks completed" };
});

app.post("/alerts/digest", async (req) => {
  const { role } = getAuth(req);
  if (role !== "ADMIN") throw new Error("Forbidden");
  await sendWeeklyDigest();
  return { ok: true, message: "Weekly digest sent" };
});

setInterval(() => { runAllAlerts().catch(console.error); }, 24 * 60 * 60 * 1000);
setInterval(() => {
  const now = new Date();
  if (now.getDay() === 1 && now.getHours() === 8) sendWeeklyDigest().catch(console.error);
}, 60 * 60 * 1000);

// --- Error handler ---
app.setErrorHandler((err, _req, reply) => {
  const msg = err instanceof Error ? err.message : "Unknown error";
  reply.status(400).send({ error: msg });
});

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" })
  .then(() => console.log(`API running on http://localhost:${port}`))
  .catch((err) => { app.log.error(err); process.exit(1); });

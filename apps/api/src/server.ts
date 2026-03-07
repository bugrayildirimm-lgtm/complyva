import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Fastify from "fastify";
import { z } from "zod";
import { pool } from "./db";
import { getAuth } from "./auth";
import multipart from "@fastify/multipart";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import { join, resolve } from "path";
import { runAllAlerts, sendWeeklyDigest } from "./emails";
import { logActivity } from "./activity";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow server-to-server / curl
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("CORS: origin not allowed"), false);
  },
  credentials: true,
});
app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });

const UPLOAD_DIR = join(process.cwd(), "uploads");

// Security: prevent path traversal attacks — ensures DB-stored paths can't
// escape the uploads directory (e.g. a value like "../../etc/passwd")
function safeFilePath(userProvidedPath: string): string {
  const uploadRoot = resolve(UPLOAD_DIR);
  const resolved = resolve(join(UPLOAD_DIR, userProvidedPath));
  if (!resolved.startsWith(uploadRoot + "/") && resolved !== uploadRoot) {
    throw new Error("Invalid file path");
  }
  return resolved;
}
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. Generate one with: openssl rand -hex 64");
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = "24h";
const REFRESH_EXPIRES_DAYS = 30;

// Security constants
const MAX_LOGIN_ATTEMPTS = 5;           // per account
const LOCKOUT_MINUTES = 15;
const MAX_IP_LOGIN_ATTEMPTS = 10;       // per IP per window
const IP_RATE_WINDOW_MINUTES = 15;
const MAX_CODE_ATTEMPTS = 3;            // per code
const MAX_RESEND_ATTEMPTS = 3;          // per 15 min
const MAX_RESET_REQUESTS = 3;           // per email per hour
const RESET_TOKEN_MINUTES = 15;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const INACTIVITY_TIMEOUT_MINUTES = 30;

async function createSession(userId, orgId, token, req) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const ip = String(req.headers["x-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
  const ua = String(req.headers["user-agent"] || "Unknown device");
  let device = "Unknown device";
  if (ua.includes("Windows")) device = "Windows";
  else if (ua.includes("Mac")) device = "macOS";
  else if (ua.includes("Linux")) device = "Linux";
  else if (ua.includes("iPhone")) device = "iPhone";
  else if (ua.includes("Android")) device = "Android";
  if (ua.includes("Chrome") && !ua.includes("Edg")) device += " · Chrome";
  else if (ua.includes("Firefox")) device += " · Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) device += " · Safari";
  else if (ua.includes("Edg")) device += " · Edge";
  await pool.query("INSERT INTO sessions (user_id, org_id, token_hash, device_info, ip_address) VALUES ($1, $2, $3, $4, $5)", [userId, orgId, tokenHash, device, ip]);
}

// Rate limiter helper — returns { allowed: boolean, attempts: number }
async function checkRateLimit(key: string, action: string, maxAttempts: number, windowMinutes: number): Promise<{ allowed: boolean; attempts: number }> {
  // Clean expired windows
  await pool.query(`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '${windowMinutes} minutes'`);
  
  const existing = await pool.query(
    `SELECT attempts, window_start FROM rate_limits WHERE key = $1 AND action = $2`,
    [key, action]
  );
  
  if (existing.rows.length === 0) {
    await pool.query(
      `INSERT INTO rate_limits (key, action, attempts, window_start) VALUES ($1, $2, 1, NOW())`,
      [key, action]
    );
    return { allowed: true, attempts: 1 };
  }
  
  const row = existing.rows[0];
  const windowStart = new Date(row.window_start);
  const windowEnd = new Date(windowStart.getTime() + windowMinutes * 60 * 1000);
  
  if (new Date() > windowEnd) {
    // Window expired, reset
    await pool.query(
      `UPDATE rate_limits SET attempts = 1, window_start = NOW() WHERE key = $1 AND action = $2`,
      [key, action]
    );
    return { allowed: true, attempts: 1 };
  }
  
  if (row.attempts >= maxAttempts) {
    return { allowed: false, attempts: row.attempts };
  }
  
  await pool.query(
    `UPDATE rate_limits SET attempts = attempts + 1 WHERE key = $1 AND action = $2`,
    [key, action]
  );
  return { allowed: true, attempts: row.attempts + 1 };
}

// Get client IP from request
function getClientIp(req: any): string {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || req.ip || "unknown";
}

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

app.get("/dashboard/enhanced", async (req) => {
  const { orgId } = getAuth(req);
  const mttrResult = await pool.query(`SELECT ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_date::timestamptz, updated_at) - created_at)) / 86400), 1) as avg_days FROM incidents WHERE org_id = \$1 AND status IN ('RESOLVED','CLOSED') AND created_at >= now() - interval '90 days'`, [orgId]);
  const capaEffResult = await pool.query(`SELECT count(*) FILTER (WHERE effectiveness_status = 'EFFECTIVE')::int as effective, count(*) FILTER (WHERE effectiveness_status IS NOT NULL)::int as total FROM capas WHERE org_id = \$1`, [orgId]);
  const overdueResult = await pool.query(`SELECT (SELECT count(*)::int FROM nonconformities WHERE org_id = \$1 AND due_date < current_date AND status NOT IN ('VERIFIED','CLOSED')) as overdue_ncs, (SELECT count(*)::int FROM capas WHERE org_id = \$1 AND due_date < current_date AND status NOT IN ('CLOSED')) as overdue_capas, (SELECT count(*)::int FROM risks WHERE org_id = \$1 AND due_date < current_date AND status IN ('OPEN','IN_TREATMENT')) as overdue_risks, (SELECT count(*)::int FROM audit_findings WHERE org_id = \$1 AND due_date < current_date AND status IN ('OPEN','IN_PROGRESS')) as overdue_findings`, [orgId]);
  const riskTreatment = await pool.query(`SELECT count(*)::int as total, count(*) FILTER (WHERE status IN ('ACCEPTED','CLOSED'))::int as treated FROM risks WHERE org_id = \$1 AND status != 'REJECTED'`, [orgId]);
  const auditCompletion = await pool.query(`SELECT count(*)::int as total, count(*) FILTER (WHERE status = 'COMPLETED')::int as completed FROM audits WHERE org_id = \$1 AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now())`, [orgId]);
  const ncClosure = await pool.query(`SELECT count(*)::int as total, count(*) FILTER (WHERE status IN ('VERIFIED','CLOSED'))::int as closed FROM nonconformities WHERE org_id = \$1 AND created_at >= now() - interval '180 days'`, [orgId]);
  const kriHighRisks = await pool.query(`SELECT count(*)::int as count FROM risks WHERE org_id = \$1 AND inherent_score >= 15 AND status IN ('OPEN','IN_TREATMENT','PENDING_REVIEW')`, [orgId]);
  const kriRecentCritical = await pool.query(`SELECT count(*)::int as count FROM incidents WHERE org_id = \$1 AND severity = 'CRITICAL' AND created_at >= now() - interval '30 days'`, [orgId]);
  const kriExpiredCerts = await pool.query(`SELECT count(*)::int as count FROM certifications WHERE org_id = \$1 AND status = 'ACTIVE' AND expiry_date < current_date`, [orgId]);
  const kriWeakControls = await pool.query(`SELECT count(*)::int as count FROM risks WHERE org_id = \$1 AND control_effectiveness >= 3 AND status IN ('OPEN','IN_TREATMENT')`, [orgId]);
  const trendMonths = await pool.query(`SELECT to_char(d, 'YYYY-MM') as month, to_char(d, 'Mon') as label FROM generate_series(date_trunc('month', now() - interval '5 months'), date_trunc('month', now()), interval '1 month') as d ORDER BY d`);
  const months = trendMonths.rows;
  const trendIncidents = await pool.query(`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*)::int as count FROM incidents WHERE org_id = \$1 AND created_at >= date_trunc('month', now() - interval '5 months') GROUP BY 1 ORDER BY 1`, [orgId]);
  const trendRisks = await pool.query(`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*)::int as count FROM risks WHERE org_id = \$1 AND created_at >= date_trunc('month', now() - interval '5 months') GROUP BY 1 ORDER BY 1`, [orgId]);
  const trendNCs = await pool.query(`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*)::int as count FROM nonconformities WHERE org_id = \$1 AND created_at >= date_trunc('month', now() - interval '5 months') GROUP BY 1 ORDER BY 1`, [orgId]);
  const trendCAPAs = await pool.query(`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*)::int as count FROM capas WHERE org_id = \$1 AND created_at >= date_trunc('month', now() - interval '5 months') GROUP BY 1 ORDER BY 1`, [orgId]);
  function fillTrend(data, months) { const map = new Map(data.map((d) => [d.month, d.count])); return months.map((m) => ({ month: m.month, label: m.label, count: map.get(m.month) ?? 0 })); }
  const recentLinks = await pool.query(`SELECT id, source_type, source_id, source_title, target_type, target_id, target_title, link_type, created_at FROM cross_links WHERE org_id = \$1 ORDER BY created_at DESC LIMIT 10`, [orgId]);
  const recentActivity = await pool.query(`SELECT a.id, a.action, a.entity_type, a.entity_id, a.meta, a.created_at, u.full_name, u.email FROM activity_log a LEFT JOIN users u ON u.id = a.actor_user_id WHERE a.org_id = \$1 ORDER BY a.created_at DESC LIMIT 10`, [orgId]);
  const od = overdueResult.rows[0] ?? {};
  const totalOverdue = (od.overdue_ncs ?? 0) + (od.overdue_capas ?? 0) + (od.overdue_risks ?? 0) + (od.overdue_findings ?? 0);
  const ce = capaEffResult.rows[0]; const cer = ce.total > 0 ? Math.round((ce.effective / ce.total) * 100) : null;
  const rt = riskTreatment.rows[0]; const rtr = rt.total > 0 ? Math.round((rt.treated / rt.total) * 100) : null;
  const ac = auditCompletion.rows[0]; const acr = ac.total > 0 ? Math.round((ac.completed / ac.total) * 100) : null;
  const nc = ncClosure.rows[0]; const ncr = nc.total > 0 ? Math.round((nc.closed / nc.total) * 100) : null;
  return { kpis: { mttr: mttrResult.rows[0]?.avg_days ? Number(mttrResult.rows[0].avg_days) : null, capaEffectivenessRate: cer, capaEffective: ce.effective, capaTotal: ce.total, totalOverdue, overdueNCs: od.overdue_ncs ?? 0, overdueCAPAs: od.overdue_capas ?? 0, overdueRisks: od.overdue_risks ?? 0, overdueFindings: od.overdue_findings ?? 0, riskTreatmentRate: rtr, riskTreated: rt.treated, riskTotal: rt.total, auditCompletionRate: acr, auditCompleted: ac.completed, auditTotal: ac.total, ncClosureRate: ncr, ncClosed: nc.closed, ncTotal: nc.total }, kris: { highRisks: kriHighRisks.rows[0]?.count ?? 0, recentCriticalIncidents: kriRecentCritical.rows[0]?.count ?? 0, expiredCerts: kriExpiredCerts.rows[0]?.count ?? 0, weakControls: kriWeakControls.rows[0]?.count ?? 0 }, trends: { incidents: fillTrend(trendIncidents.rows, months), risks: fillTrend(trendRisks.rows, months), ncs: fillTrend(trendNCs.rows, months), capas: fillTrend(trendCAPAs.rows, months) }, recentLinks: recentLinks.rows, recentActivity: recentActivity.rows };
});

app.get("/dashboard/summary", async (req) => {
  const { orgId } = getAuth(req);

  // Certifications
  const expiringSoon = await pool.query(
    `select count(*)::int as count from certifications
     where org_id = $1 and expiry_date is not null
       and expiry_date <= (current_date + interval '60 days') and status = 'ACTIVE'`,
    [orgId]
  );
  const totalCerts = await pool.query(
    `select count(*)::int as count from certifications where org_id = $1`, [orgId]
  );

  // Risks
  const openRisks = await pool.query(
    `select count(*)::int as count from risks
     where org_id = $1 and status in ('OPEN','IN_TREATMENT')`,
    [orgId]
  );
  const pendingRisks = await pool.query(
    `select count(*)::int as count from risks where org_id = $1 and status = 'PENDING_REVIEW'`, [orgId]
  );
  const risksByLevel = await pool.query(
    `select
       count(*) filter (where inherent_score >= 20)::int as critical,
       count(*) filter (where inherent_score >= 10 and inherent_score < 20)::int as high,
       count(*) filter (where inherent_score >= 5 and inherent_score < 10)::int as medium,
       count(*) filter (where inherent_score < 5)::int as low
     from risks where org_id = $1 and status in ('OPEN','IN_TREATMENT','PENDING_REVIEW')`, [orgId]
  );

  // Audits
  const activeAudits = await pool.query(
    `select count(*)::int as count from audits
     where org_id = $1 and status = 'IN_PROGRESS'`,
    [orgId]
  );
  const openFindings = await pool.query(
    `select count(*)::int as count from audit_findings
     where org_id = $1 and status in ('OPEN','IN_PROGRESS')`,
    [orgId]
  );

  // Assets
  const totalAssets = await pool.query(
    `select count(*)::int as count from assets where org_id = $1`, [orgId]
  );
  const criticalAssets = await pool.query(
    `select count(*)::int as count from assets where org_id = $1 and combined_classification >= 3`, [orgId]
  );

  // Incidents
  const openIncidents = await pool.query(
    `select count(*)::int as count from incidents where org_id = $1 and status in ('OPEN','INVESTIGATING','CONTAINED')`, [orgId]
  );
  const criticalIncidents = await pool.query(
    `select count(*)::int as count from incidents where org_id = $1 and severity = 'CRITICAL' and status != 'CLOSED'`, [orgId]
  );

  // Changes
  const pendingChanges = await pool.query(
    `select count(*)::int as count from changes where org_id = $1 and status in ('DRAFT','SUBMITTED')`, [orgId]
  );
  const activeChanges = await pool.query(
    `select count(*)::int as count from changes where org_id = $1 and status in ('APPROVED','IN_PROGRESS')`, [orgId]
  );

  // Non-Conformities
  const openNCs = await pool.query(
    `select count(*)::int as count from nonconformities where org_id = $1 and status not in ('VERIFIED','CLOSED')`, [orgId]
  );
  const overdueNCs = await pool.query(
    `select count(*)::int as count from nonconformities where org_id = $1 and due_date < current_date and status not in ('VERIFIED','CLOSED')`, [orgId]
  );

  // CAPAs
  const openCAPAs = await pool.query(
    `select count(*)::int as count from capas where org_id = $1 and status not in ('CLOSED')`, [orgId]
  );
  const overdueCAPAs = await pool.query(
    `select count(*)::int as count from capas where org_id = $1 and due_date < current_date and status not in ('CLOSED')`, [orgId]
  );
  const ineffectiveCAPAs = await pool.query(
    `select count(*)::int as count from capas where org_id = $1 and effectiveness_status = 'NOT_EFFECTIVE'`, [orgId]
  );


  // Top risks
  const topRisks = await pool.query(
    `select id, title, category, likelihood, impact, inherent_score, status
     from risks where org_id = $1 and status in ('OPEN','IN_TREATMENT')
     order by inherent_score desc limit 5`, [orgId]
  );

  return {
    // Certifications
    expiringSoon: expiringSoon.rows[0]?.count ?? 0,
    totalCerts: totalCerts.rows[0]?.count ?? 0,
    // Risks
    openRisks: openRisks.rows[0]?.count ?? 0,
    pendingRisks: pendingRisks.rows[0]?.count ?? 0,
    risksByLevel: risksByLevel.rows[0] ?? { critical: 0, high: 0, medium: 0, low: 0 },
    // Audits
    activeAudits: activeAudits.rows[0]?.count ?? 0,
    openFindings: openFindings.rows[0]?.count ?? 0,
    // Assets
    totalAssets: totalAssets.rows[0]?.count ?? 0,
    criticalAssets: criticalAssets.rows[0]?.count ?? 0,
    // Incidents
    openIncidents: openIncidents.rows[0]?.count ?? 0,
    criticalIncidents: criticalIncidents.rows[0]?.count ?? 0,
    // Changes
    pendingChanges: pendingChanges.rows[0]?.count ?? 0,
    activeChanges: activeChanges.rows[0]?.count ?? 0,
    // NCs
    openNCs: openNCs.rows[0]?.count ?? 0,
    overdueNCs: overdueNCs.rows[0]?.count ?? 0,
    // CAPAs
    openCAPAs: openCAPAs.rows[0]?.count ?? 0,
    overdueCAPAs: overdueCAPAs.rows[0]?.count ?? 0,
    ineffectiveCAPAs: ineffectiveCAPAs.rows[0]?.count ?? 0,
    // Lists
    topRisks: topRisks.rows,
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
  frequency: z.number().int().min(1).max(5).optional(),
  controlEffectiveness: z.number().int().min(1).max(4).optional(),
  residualLikelihood: z.number().int().min(1).max(5).optional(),
  residualImpact: z.number().int().min(1).max(5).optional(),
  status: z.enum(["PENDING_REVIEW", "OPEN", "IN_PROGRESS", "ON_HOLD", "OVERDUE", "IN_TREATMENT", "ACCEPTED", "CLOSED", "REJECTED"]).optional(),
  treatmentPlan: z.string().max(5000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sourceType: z.enum(["MANUAL", "FINDING", "NON_CONFORMITY", "INCIDENT"]).optional(),
  sourceId: z.string().uuid().optional(),
  // New fields — Risk Identification
  ridNumber: z.string().max(50).optional(),
  processName: z.string().max(200).optional(),
  subProcess: z.string().max(200).optional(),
  riskOwner: z.string().max(200).optional(),
  riskName: z.string().max(200).optional(),
  riskDescription: z.string().max(5000).optional(),
  clarification: z.string().max(5000).optional(),
  opportunities: z.string().max(2000).optional(),
  targetBenefit: z.number().optional(),
  existingControls: z.string().max(5000).optional(),
  controlEffectivenessDesc: z.string().max(50).optional(),
  // New fields — Inherent Risk
  impactDesc: z.string().max(50).optional(),
  frequencyDesc: z.string().max(50).optional(),
  inherentRiskDesc: z.string().max(50).optional(),
  // New fields — Residual Risk
  controlScore: z.number().int().min(1).max(5).nullable().optional(),
  controlEffectivenessLabel: z.string().max(50).nullable().optional(),
  residualScore: z.number().nullable().optional(),
  residualRiskDesc: z.string().max(50).nullable().optional(),
  // New fields — Action Plan
  riskStrategy: z.string().max(200).optional(),
  proposedActions: z.string().max(5000).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  responsible: z.string().max(200).optional(),
  // New fields — Monitoring
  monitoringPeriod: z.string().max(200).nullable().optional(),
  reporting: z.string().max(500).nullable().optional(),
  lastReviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // New fields — Cost-Impact
  probability: z.number().optional(),
  minCost: z.number().optional(),
  mostLikelyCost: z.number().optional(),
  maxCost: z.number().optional(),
  expectedValue: z.number().optional(),
  opportunityImpact: z.number().optional(),
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
  // Auto-calculate residual from inherent × control
  const calcResidualScore = p.controlScore ? inherentScore * p.controlScore : null;
  // Auto-calculate expected value (PERT)
  let calcExpectedValue: number | null = null;
  if (p.mostLikelyCost != null) {
    const mn = p.minCost ?? 0;
    const ml = p.mostLikelyCost;
    const mx = p.maxCost ?? 0;
    const pert = (mn + 4 * ml + mx) / 6;
    calcExpectedValue = (p.frequency ? p.frequency / 5 : p.likelihood / 5) * pert;
  }
  const r = await pool.query(
    `insert into risks
      (org_id, title, description, category, likelihood, impact, frequency, control_effectiveness,
       inherent_score, residual_likelihood, residual_impact, residual_score,
       status, owner_user_id, treatment_plan, due_date,
       rid_number, process_name, sub_process, risk_owner, risk_name, risk_description,
       clarification, opportunities, target_benefit, existing_controls, control_effectiveness_desc,
       impact_desc, frequency_desc, inherent_risk_desc,
       control_score, control_effectiveness_label, residual_risk_desc,
       risk_strategy, proposed_actions, deadline, responsible,
       monitoring_period, reporting, last_reviewed,
       probability, min_cost, most_likely_cost, max_cost, expected_value, opportunity_impact)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
             $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
             $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46) returning *`,
    [orgId, p.title, p.description ?? null, p.category ?? null,
     p.likelihood, p.impact, p.frequency ?? null, p.controlEffectiveness ?? null,
     inherentScore, p.residualLikelihood ?? null, p.residualImpact ?? null, residualScore ?? calcResidualScore,
     p.status ?? "OPEN", userId, p.treatmentPlan ?? null, p.dueDate ?? null,
     p.ridNumber ?? null, p.processName ?? null, p.subProcess ?? null, p.riskOwner ?? null,
     p.riskName ?? null, p.riskDescription ?? null, p.clarification ?? null,
     p.opportunities ?? null, p.targetBenefit ?? null, p.existingControls ?? null,
     p.controlEffectivenessDesc ?? null, p.impactDesc ?? null, p.frequencyDesc ?? null,
     p.inherentRiskDesc ?? null, p.controlScore ?? null, p.controlEffectivenessLabel ?? null,
     p.residualRiskDesc ?? null, p.riskStrategy ?? null, p.proposedActions ?? null,
     p.deadline ?? null, p.responsible ?? null, p.monitoringPeriod ?? null,
     p.reporting ?? null, p.lastReviewed ?? null,
     p.probability ?? (p.frequency ? p.frequency / 5 : null),
     p.minCost ?? null, p.mostLikelyCost ?? null, p.maxCost ?? null,
     calcExpectedValue, p.opportunityImpact ?? null]
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

  // Simple field mappings (camelCase -> snake_case)
  const fieldMap: Record<string, string> = {
    title: "title", description: "description", category: "category",
    likelihood: "likelihood", impact: "impact", frequency: "frequency",
    controlEffectiveness: "control_effectiveness",
    residualLikelihood: "residual_likelihood", residualImpact: "residual_impact",
    status: "status", treatmentPlan: "treatment_plan", dueDate: "due_date",
    ridNumber: "rid_number", processName: "process_name", subProcess: "sub_process",
    riskOwner: "risk_owner", riskName: "risk_name", riskDescription: "risk_description",
    clarification: "clarification", opportunities: "opportunities",
    targetBenefit: "target_benefit", existingControls: "existing_controls",
    controlEffectivenessDesc: "control_effectiveness_desc",
    impactDesc: "impact_desc", frequencyDesc: "frequency_desc", inherentRiskDesc: "inherent_risk_desc",
    controlScore: "control_score", controlEffectivenessLabel: "control_effectiveness_label",
    residualScore: "residual_score", residualRiskDesc: "residual_risk_desc",
    riskStrategy: "risk_strategy", proposedActions: "proposed_actions",
    deadline: "deadline", responsible: "responsible",
    monitoringPeriod: "monitoring_period", reporting: "reporting", lastReviewed: "last_reviewed",
    probability: "probability", minCost: "min_cost", mostLikelyCost: "most_likely_cost",
    maxCost: "max_cost", expectedValue: "expected_value", opportunityImpact: "opportunity_impact",
  };

  for (const [camel, snake] of Object.entries(fieldMap)) {
    if ((p as any)[camel] !== undefined) {
      fields.push(`${snake} = $${idx++}`);
      values.push((p as any)[camel]);
    }
  }

  // Auto-calculate inherent score when components change
  if (p.likelihood !== undefined || p.impact !== undefined) {
    const cur = await pool.query(`SELECT likelihood, impact FROM risks WHERE id = $1 AND org_id = $2`, [id, orgId]);
    if (cur.rows.length > 0) {
      const l = p.likelihood ?? cur.rows[0].likelihood;
      const i = p.impact ?? cur.rows[0].impact;
      fields.push(`inherent_score = $${idx++}`); values.push(l * i);
    }
  }
  // Auto-calculate residual score when control score or inherent changes (only if not explicitly set)
  if (p.residualScore === undefined && (p.controlScore !== undefined || p.likelihood !== undefined || p.impact !== undefined)) {
    const cur = await pool.query(`SELECT likelihood, impact, control_score, inherent_score FROM risks WHERE id = $1 AND org_id = $2`, [id, orgId]);
    if (cur.rows.length > 0) {
      const l = p.likelihood ?? cur.rows[0].likelihood;
      const i = p.impact ?? cur.rows[0].impact;
      const cs = p.controlScore ?? cur.rows[0].control_score;
      const inherent = l * i;
      if (cs && cs > 0) {
        const inherentLookup = inherent > 18 ? 5 : inherent > 11 ? 4 : inherent > 7 ? 3 : inherent > 3 ? 2 : 1;
        fields.push(`residual_score = $${idx++}`); values.push(inherentLookup * cs);
      }
    }
  }
  // Legacy residual score calc
  if (p.residualLikelihood !== undefined || p.residualImpact !== undefined) {
    const cur = await pool.query(`SELECT residual_likelihood, residual_impact FROM risks WHERE id = $1 AND org_id = $2`, [id, orgId]);
    if (cur.rows.length > 0) {
      const rl = p.residualLikelihood ?? cur.rows[0].residual_likelihood;
      const ri = p.residualImpact ?? cur.rows[0].residual_impact;
      if (rl && ri) { fields.push(`residual_score = $${idx++}`); values.push(rl * ri); }
    }
  }

  if (fields.length === 0) throw new Error("No fields to update");
  values.push(id, orgId);

  const r = await pool.query(
    `update risks set ${fields.join(", ")} where id = $${idx++} and org_id = $${idx} returning *`,
    values
  );
  if (r.rows.length === 0) throw new Error("Not found");
  await logActivity(orgId, userId, "UPDATED", "RISK", id, r.rows[0].title, `Fields: ${Object.keys(p).join(", ")}`);
  // Save score snapshot if any score-related field changed
  const scoreFields = ["likelihood", "impact", "controlScore", "residualScore", "residualLikelihood", "residualImpact"];
  if (Object.keys(p).some(k => scoreFields.includes(k))) {
    const row = r.rows[0];
    await pool.query(
      `INSERT INTO risk_score_history (risk_id, org_id, likelihood, impact, inherent_score, residual_score, changed_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, orgId, row.likelihood, row.impact, row.inherent_score, row.residual_score, userId]
    );
  }
  return r.rows[0];
});


// GET /risks/:id/score-history
app.get("/risks/:id/score-history", async (req) => {
  const { orgId } = getAuth(req);
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `SELECT h.*, u.full_name as changed_by_name FROM risk_score_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.risk_id = $1 AND h.org_id = $2 ORDER BY h.created_at ASC`,
    [id, orgId]
  );
  return r.rows;
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
    `select f.*, 
      EXISTS(SELECT 1 FROM cross_links cl WHERE cl.source_type = 'FINDING' AND cl.source_id = f.id AND cl.target_type = 'RISK' AND cl.link_type = 'GENERATED') as sent_to_risk
     from audit_findings f where f.org_id = $1 and f.audit_id = $2 order by f.created_at desc`,
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

  // Check if already sent
  const existing = await pool.query(
    `SELECT 1 FROM cross_links WHERE org_id = $1 AND source_type = 'FINDING' AND source_id = $2 AND target_type = 'RISK' AND link_type = 'GENERATED'`,
    [orgId, id]
  );
  if (existing.rows.length > 0) throw new Error("This finding has already been sent to the Risk Register");

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
  await pool.query(
    `INSERT INTO cross_links (org_id, source_type, source_id, source_title, target_type, target_id, target_title, link_type, created_by)
     VALUES ($1,'FINDING',$2,$3,'RISK',$4,$5,'GENERATED',$6)`,
    [orgId, id, finding.title, r.rows[0].id, r.rows[0].title, userId]
  );
  return r.rows[0];
});

// =======================
// ========================
// Custom Auth Endpoints
// ========================

// POST /auth/register — Create account with email/password
app.post("/auth/register", async (req) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    fullName: z.string().min(1, "Name is required"),
    orgName: z.string().optional(),
  });
  const p = schema.parse(req.body);
  
  // IP rate limiting
  const clientIp = getClientIp(req);
  const ipCheck = await checkRateLimit(clientIp, "register", MAX_IP_LOGIN_ATTEMPTS, IP_RATE_WINDOW_MINUTES);
  if (!ipCheck.allowed) {
    throw new Error("Too many registration attempts. Please try again in 15 minutes.");
  }
  
  // Password strength check
  if (!PASSWORD_REGEX.test(p.password)) {
    throw new Error("Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number");
  }
  
  const email = p.email.toLowerCase().trim();

  // Check if email already exists
  const existing = await pool.query(`SELECT id, password_hash FROM users WHERE LOWER(email) = $1`, [email]);

  if (existing.rows.length > 0) {
    if (existing.rows[0].password_hash) {
      throw new Error("An account with this email already exists. Please sign in.");
    }
    // Invited user setting password for first time — they're already verified via invite
    const hash = await bcrypt.hash(p.password, 12);
    await pool.query(
      `UPDATE users SET password_hash = $1, full_name = COALESCE(NULLIF($2, ''), full_name), email_verified = true WHERE id = $3`,
      [hash, p.fullName, existing.rows[0].id]
    );
    const userId = existing.rows[0].id;
    const mem = await pool.query(`SELECT org_id, role FROM memberships WHERE user_id = $1 LIMIT 1`, [userId]);
    if (mem.rows.length > 0) {
      const token = jwt.sign({ userId, orgId: mem.rows[0].org_id, role: mem.rows[0].role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      const refreshToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: `${REFRESH_EXPIRES_DAYS}d` });
      await createSession(userId, mem.rows[0].org_id, token, req);
      await pool.query(`UPDATE users SET refresh_token = $1, refresh_token_expires = NOW() + INTERVAL '${REFRESH_EXPIRES_DAYS} days' WHERE id = $2`, [refreshToken, userId]);
      await logActivity(mem.rows[0].org_id, userId, "JOINED_VIA_INVITE", "USER", userId, p.fullName || email);
      return { verified: true, token, refreshToken, userId, orgId: mem.rows[0].org_id, role: mem.rows[0].role };
    }
    // No membership — user was created but not invited to any org
    throw new Error("Your account is not associated with any organisation. Please contact your administrator.");
  }

  // No existing user — this is self-registration, block it
  throw new Error("Registration is invite-only. Please ask your organisation admin to invite you, or contact sales@complyva.com.");
});


// POST /auth/login — Step 1: Verify password, send email code
app.post("/auth/login", async (req) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    deviceId: z.string().optional(),
  });
  const p = schema.parse(req.body);
  const email = p.email.toLowerCase().trim();
  const clientIp = getClientIp(req);

  // IP rate limiting
  const ipCheck = await checkRateLimit(clientIp, "login", MAX_IP_LOGIN_ATTEMPTS, IP_RATE_WINDOW_MINUTES);
  if (!ipCheck.allowed) {
    throw new Error("Too many login attempts. Please try again in 15 minutes.");
  }

  const result = await pool.query(
    `SELECT u.id as user_id, u.password_hash, u.full_name, u.failed_login_attempts, u.locked_until, m.org_id, m.role
     FROM users u LEFT JOIN memberships m ON m.user_id = u.id
     WHERE LOWER(u.email) = $1 LIMIT 1`,
    [email]
  );

  if (result.rows.length === 0) throw new Error("Invalid email or password");
  const user = result.rows[0];
  if (!user.password_hash) throw new Error("Please complete registration first — check your email or sign up again.");

  // Account lockout check
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    throw new Error(`Account is temporarily locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`);
  }

  // If lock expired, reset
  if (user.locked_until && new Date(user.locked_until) <= new Date()) {
    await pool.query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [user.user_id]);
    user.failed_login_attempts = 0;
  }

  const valid = await bcrypt.compare(p.password, user.password_hash);
  if (!valid) {
    const newAttempts = (user.failed_login_attempts || 0) + 1;
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      await pool.query(
        `UPDATE users SET failed_login_attempts = $1, locked_until = NOW() + INTERVAL '${LOCKOUT_MINUTES} minutes', last_failed_login = NOW() WHERE id = $2`,
        [newAttempts, user.user_id]
      );
      throw new Error(`Account locked after ${MAX_LOGIN_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`);
    } else {
      await pool.query(
        `UPDATE users SET failed_login_attempts = $1, last_failed_login = NOW() WHERE id = $2`,
        [newAttempts, user.user_id]
      );
      const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
      throw new Error(`Invalid email or password. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining before account lockout.`);
    }
  }

  // Password correct — reset failed attempts
  await pool.query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [user.user_id]);

  if (!user.org_id) throw new Error("Account exists but no organisation found. Please contact support.");

  // Check trial/plan status
  const orgPlan = await pool.query(
    `SELECT plan, plan_expires_at, trial_started_at FROM organisations WHERE id = $1`,
    [user.org_id]
  );
  if (orgPlan.rows.length > 0) {
    const org = orgPlan.rows[0];
    if (org.plan === "trial" && org.plan_expires_at && new Date(org.plan_expires_at) < new Date()) {
      throw new Error("Your free trial has expired. Please contact sales@complyva.com to activate your subscription.");
    }
    if (org.plan === "suspended") {
      throw new Error("Your account has been suspended. Please contact support@complyva.com.");
    }
  }

  // Check if device is trusted
  if (p.deviceId) {
    const deviceHash = crypto.createHash("sha256").update(p.deviceId).digest("hex");
    const trusted = await pool.query(
      `SELECT id FROM trusted_devices WHERE user_id = $1 AND device_hash = $2 AND expires_at > NOW()`,
      [user.user_id, deviceHash]
    );
    if (trusted.rows.length > 0) {
      await pool.query(`UPDATE trusted_devices SET last_used = NOW() WHERE id = $1`, [trusted.rows[0].id]);
      const token = jwt.sign({ userId: user.user_id, orgId: user.org_id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      const refreshToken = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: `${REFRESH_EXPIRES_DAYS}d` });
      await createSession(user.user_id, user.org_id, token, req);
      await pool.query(`UPDATE users SET refresh_token = $1, refresh_token_expires = NOW() + INTERVAL '${REFRESH_EXPIRES_DAYS} days' WHERE id = $2`, [refreshToken, user.user_id]);
      return { verified: true, token, refreshToken, userId: user.user_id, orgId: user.org_id, role: user.role, fullName: user.full_name };
    }
  }

  // Generate 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(`DELETE FROM login_codes WHERE user_id = $1`, [user.user_id]);
  await pool.query(
    `INSERT INTO login_codes (user_id, code, expires_at, attempts) VALUES ($1, $2, $3, 0)`,
    [user.user_id, code, expiresAt]
  );

  const { sendEmail } = await import("./emails");
  await sendEmail(
    email,
    `Your Complyva login code: ${code}`,
    `
    <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
      <h2 style="color: #111; margin-bottom: 4px;">Your login verification code</h2>
      <p style="color: #6b7280; margin-top: 0;">Enter this code to complete your sign in:</p>
      <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111;">${code}</span>
      </div>
      <p style="color: #6b7280; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">— Complyva</p>
    </div>
    `
  );

  return { verified: false, userId: user.user_id, message: "Verification code sent to your email" };
});

// POST /auth/verify-code — Step 2: Verify the emailed code, issue tokens
app.post("/auth/verify-code", async (req) => {
  const schema = z.object({
    userId: z.string(),
    code: z.string().length(6),
    rememberDevice: z.boolean().optional(),
    deviceId: z.string().optional(),
  });
  const p = schema.parse(req.body);

  // Check if code exists and hasn't exceeded attempts
  const codeRow = await pool.query(
    `SELECT id, attempts FROM login_codes WHERE user_id = $1 AND used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
    [p.userId]
  );

  if (codeRow.rows.length === 0) throw new Error("No active verification code. Please request a new one.");

  if (codeRow.rows[0].attempts >= MAX_CODE_ATTEMPTS) {
    // Invalidate the code
    await pool.query(`UPDATE login_codes SET used = true WHERE id = $1`, [codeRow.rows[0].id]);
    throw new Error("Too many incorrect attempts. Please request a new code.");
  }

  // Increment attempt counter
  await pool.query(`UPDATE login_codes SET attempts = attempts + 1 WHERE id = $1`, [codeRow.rows[0].id]);

  const result = await pool.query(
    `SELECT lc.id, lc.user_id, u.full_name, u.email, m.org_id, m.role
     FROM login_codes lc
     JOIN users u ON u.id = lc.user_id
     JOIN memberships m ON m.user_id = u.id
     WHERE lc.user_id = $1 AND lc.code = $2 AND lc.used = false AND lc.expires_at > NOW()
     LIMIT 1`,
    [p.userId, p.code]
  );

  if (result.rows.length === 0) {
    const attemptsLeft = MAX_CODE_ATTEMPTS - (codeRow.rows[0].attempts + 1);
    if (attemptsLeft <= 0) {
      throw new Error("Too many incorrect attempts. Please request a new code.");
    }
    throw new Error(`Invalid code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining.`);
  }

  const row = result.rows[0];

  // Mark code as used
  await pool.query(`UPDATE login_codes SET used = true WHERE id = $1`, [row.id]);

  // Trust device if requested
  if (p.rememberDevice && p.deviceId) {
    const deviceHash = crypto.createHash("sha256").update(p.deviceId).digest("hex");
    await pool.query(`DELETE FROM trusted_devices WHERE user_id = $1 AND device_hash = $2`, [row.user_id, deviceHash]);
    await pool.query(
      `INSERT INTO trusted_devices (user_id, device_hash, label, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
      [row.user_id, deviceHash, req.headers["user-agent"]?.slice(0, 200) || "Unknown"]
    );
  }

  // Issue tokens
  const token = jwt.sign({ userId: row.user_id, orgId: row.org_id, role: row.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  const refreshToken = jwt.sign({ userId: row.user_id }, JWT_SECRET, { expiresIn: `${REFRESH_EXPIRES_DAYS}d` });
      await createSession(row.user_id, row.org_id, token, req);
  await pool.query(`UPDATE users SET refresh_token = $1, refresh_token_expires = NOW() + INTERVAL '${REFRESH_EXPIRES_DAYS} days' WHERE id = $2`, [refreshToken, row.user_id]);

  return { verified: true, token, refreshToken, userId: row.user_id, orgId: row.org_id, role: row.role, fullName: row.full_name };
});

// POST /auth/resend-code — Resend verification code (rate limited)
app.post("/auth/resend-code", async (req) => {
  const schema = z.object({ userId: z.string() });
  const p = schema.parse(req.body);

  // Rate limit resends: 3 per 15 minutes per user
  const resendCheck = await checkRateLimit(p.userId, "resend_code", MAX_RESEND_ATTEMPTS, 15);
  if (!resendCheck.allowed) {
    throw new Error("Too many code requests. Please wait 15 minutes before requesting a new code.");
  }

  const user = await pool.query(`SELECT id, email, full_name FROM users WHERE id = $1`, [p.userId]);
  if (user.rows.length === 0) throw new Error("User not found");

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(`DELETE FROM login_codes WHERE user_id = $1`, [p.userId]);
  await pool.query(`INSERT INTO login_codes (user_id, code, expires_at, attempts) VALUES ($1, $2, $3, 0)`, [p.userId, code, expiresAt]);

  const { sendEmail } = await import("./emails");
  await sendEmail(
    user.rows[0].email,
    `Your Complyva login code: ${code}`,
    `
    <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
      <h2 style="color: #111; margin-bottom: 4px;">Your login verification code</h2>
      <p style="color: #6b7280; margin-top: 0;">Enter this code to complete your sign in:</p>
      <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111;">${code}</span>
      </div>
      <p style="color: #6b7280; font-size: 13px;">This code expires in 10 minutes.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">— Complyva</p>
    </div>
    `
  );

  return { success: true, message: "New code sent" };
});

// GET /auth/me — Get current user from JWT
app.get("/auth/me", async (req) => {
  const authHeader = String(req.headers.authorization ?? "");
  if (!authHeader.startsWith("Bearer ")) throw new Error("No token");
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; orgId: string; role: string };
    const user = await pool.query(
      `SELECT u.id, u.email, u.full_name, m.org_id, m.role, o.name as org_name
       FROM users u JOIN memberships m ON m.user_id = u.id JOIN organisations o ON o.id = m.org_id
       WHERE u.id = $1 AND m.org_id = $2 LIMIT 1`,
      [decoded.userId, decoded.orgId]
    );
    if (user.rows.length === 0) throw new Error("User not found");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await pool.query("UPDATE sessions SET last_active = NOW() WHERE token_hash = $1 AND revoked = false", [tokenHash]).catch(() => {});
    return user.rows[0];
  } catch {
    throw new Error("Invalid or expired token");
  }
});


// GET /account/sessions
app.get("/account/sessions", async (req) => {
  const { userId } = getAuth(req);
  const authHeader = String(req.headers.authorization || req.headers["x-token"] || "");
  const currentToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const currentHash = currentToken ? crypto.createHash("sha256").update(currentToken).digest("hex") : "";
  const r = await pool.query("SELECT id, device_info, ip_address, last_active, created_at, token_hash FROM sessions WHERE user_id = \$1 AND revoked = false ORDER BY last_active DESC LIMIT 10", [userId]);
  return r.rows.map(s => ({ id: s.id, device_info: s.device_info, ip_address: s.ip_address, last_active: s.last_active, created_at: s.created_at, is_current: s.token_hash === currentHash }));
});

// DELETE /account/sessions/:id
app.delete("/account/sessions/:id", async (req) => {
  const { userId } = getAuth(req);
  const { id } = req.params;
  await pool.query("UPDATE sessions SET revoked = true WHERE id = \$1 AND user_id = \$2", [id, userId]);
  return { ok: true };
});

// POST /account/sessions/revoke-all
app.post("/account/sessions/revoke-all", async (req) => {
  const { userId } = getAuth(req);
  const authHeader = String(req.headers.authorization || "");
  const currentToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const currentHash = currentToken ? crypto.createHash("sha256").update(currentToken).digest("hex") : "";
  await pool.query("UPDATE sessions SET revoked = true WHERE user_id = \$1 AND revoked = false AND token_hash != \$2", [userId, currentHash]);
  return { ok: true };
});

// POST /auth/heartbeat
app.post("/auth/heartbeat", async (req) => {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.slice(7);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await pool.query("UPDATE sessions SET last_active = NOW() WHERE token_hash = \$1 AND revoked = false", [tokenHash]);
  return { ok: true };
});

// GET /auth/orgs — List all orgs the user belongs to
app.get("/auth/orgs", async (req) => {
  const authHeader = String(req.headers.authorization ?? "");
  if (!authHeader.startsWith("Bearer ")) throw new Error("No token");
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; orgId: string };
    const orgs = await pool.query(
      `SELECT o.id, o.name, m.role, o.created_at,
              (SELECT COUNT(*)::int FROM memberships WHERE org_id = o.id) as member_count
       FROM memberships m JOIN organisations o ON o.id = m.org_id
       WHERE m.user_id = $1 ORDER BY o.name`,
      [decoded.userId]
    );
    return { orgs: orgs.rows, currentOrgId: decoded.orgId };
  } catch {
    throw new Error("Invalid or expired token");
  }
});

// POST /auth/switch-org — Switch to a different org, issue new token
app.post("/auth/switch-org", async (req) => {
  const authHeader = String(req.headers.authorization ?? "");
  if (!authHeader.startsWith("Bearer ")) throw new Error("No token");
  const token = authHeader.slice(7);
  const schema = z.object({ orgId: z.string() });
  const p = schema.parse(req.body);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    // Verify user has membership in this org
    const mem = await pool.query(
      `SELECT m.role FROM memberships m WHERE m.user_id = $1 AND m.org_id = $2`,
      [decoded.userId, p.orgId]
    );
    if (mem.rows.length === 0) throw new Error("You do not have access to this organisation");
    const newToken = jwt.sign({ userId: decoded.userId, orgId: p.orgId, role: mem.rows[0].role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    const refreshToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: `${REFRESH_EXPIRES_DAYS}d` });
      await createSession(userId, mem.rows[0].org_id, token, req);
    await pool.query(`UPDATE users SET refresh_token = $1, refresh_token_expires = NOW() + INTERVAL '${REFRESH_EXPIRES_DAYS} days' WHERE id = $2`, [refreshToken, decoded.userId]);
    return { token: newToken, refreshToken, orgId: p.orgId, role: mem.rows[0].role };
  } catch (err: any) {
    throw new Error(err.message || "Failed to switch organisation");
  }
});

// POST /auth/refresh — Refresh JWT token
app.post("/auth/refresh", async (req) => {
  const schema = z.object({ refreshToken: z.string() });
  const p = schema.parse(req.body);
  try {
    const decoded = jwt.verify(p.refreshToken, JWT_SECRET) as { userId: string };
    const user = await pool.query(
      `SELECT u.id, u.refresh_token, u.refresh_token_expires, m.org_id, m.role
       FROM users u JOIN memberships m ON m.user_id = u.id
       WHERE u.id = $1 AND u.refresh_token = $2 AND u.refresh_token_expires > NOW() LIMIT 1`,
      [decoded.userId, p.refreshToken]
    );
    if (user.rows.length === 0) throw new Error("Invalid refresh token");
    const row = user.rows[0];
    const token = jwt.sign({ userId: row.id, orgId: row.org_id, role: row.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    return { token, userId: row.id, orgId: row.org_id, role: row.role };
  } catch {
    throw new Error("Invalid refresh token");
  }
});

// POST /auth/change-password
app.post("/auth/change-password", async (req) => {
  const { userId } = getAuth(req);
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  });
  const p = schema.parse(req.body);
  
  // Password strength check
  if (!PASSWORD_REGEX.test(p.newPassword)) {
    throw new Error("Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number");
  }
  
  const user = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
  if (user.rows.length === 0) throw new Error("User not found");
  const valid = await bcrypt.compare(p.currentPassword, user.rows[0].password_hash);
  if (!valid) throw new Error("Current password is incorrect");
  const hash = await bcrypt.hash(p.newPassword, 12);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, userId]);
  return { success: true };
});

// POST /auth/forgot-password — Request password reset email
app.post("/auth/forgot-password", async (req) => {
  const schema = z.object({ email: z.string().email() });
  const p = schema.parse(req.body);
  const email = p.email.toLowerCase().trim();

  // Rate limit: 3 reset requests per email per hour
  const resetCheck = await checkRateLimit(email, "forgot_password", MAX_RESET_REQUESTS, 60);
  if (!resetCheck.allowed) {
    // Don't reveal rate limit — just return success
    return { success: true, message: "If an account exists with this email, a reset link has been sent." };
  }

  const user = await pool.query(`SELECT id, full_name FROM users WHERE LOWER(email) = $1`, [email]);
  
  // Always return same response — don't reveal if email exists
  if (user.rows.length === 0) {
    return { success: true, message: "If an account exists with this email, a reset link has been sent." };
  }

  const userId = user.rows[0].id;
  const fullName = user.rows[0].full_name;

  // Generate secure token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);

  // Invalidate any existing reset tokens for this user
  await pool.query(`UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false`, [userId]);

  // Store new token
  await pool.query(
    `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, resetToken, expiresAt]
  );

  // Send reset email
  const resetUrl = `https://complyva.com/reset-password?token=${resetToken}`;
  const { sendEmail } = await import("./emails");
  await sendEmail(
    email,
    "Reset your Complyva password",
    `
    <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
      <h2 style="color: #111; margin-bottom: 4px;">Reset your password</h2>
      <p style="color: #6b7280; margin-top: 0;">Hi ${fullName || "there"},</p>
      <p style="color: #374151;">We received a request to reset your password. Click the button below to choose a new one:</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}" style="background: #111; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #6b7280; font-size: 13px;">This link expires in ${RESET_TOKEN_MINUTES} minutes and can only be used once.</p>
      <p style="color: #6b7280; font-size: 13px;">If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">— Complyva</p>
    </div>
    `
  );

  return { success: true, message: "If an account exists with this email, a reset link has been sent." };
});

// POST /auth/reset-password — Use token to set new password
app.post("/auth/reset-password", async (req) => {
  const schema = z.object({
    token: z.string().min(1),
    newPassword: z.string().min(8),
  });
  const p = schema.parse(req.body);

  // Password strength check
  if (!PASSWORD_REGEX.test(p.newPassword)) {
    throw new Error("Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number");
  }

  const result = await pool.query(
    `SELECT pr.id, pr.user_id FROM password_resets pr
     WHERE pr.token = $1 AND pr.used = false AND pr.expires_at > NOW()
     LIMIT 1`,
    [p.token]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid or expired reset link. Please request a new one.");
  }

  const { id: resetId, user_id: userId } = result.rows[0];

  // Hash new password
  const hash = await bcrypt.hash(p.newPassword, 12);

  // Update password, reset lockout, mark token as used, verify email (for invited users)
  await pool.query(`UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL, email_verified = true WHERE id = $2`, [hash, userId]);
  await pool.query(`UPDATE password_resets SET used = true WHERE id = $1`, [resetId]);

  // Invalidate all trusted devices (force re-auth everywhere)
  await pool.query(`DELETE FROM trusted_devices WHERE user_id = $1`, [userId]);

  return { success: true, message: "Password has been reset. You can now sign in." };
});

// Auth Sync (Clerk → DB) — LEGACY: kept for backward compatibility during migration
// =======================
app.post("/auth/sync", async (req) => {
  const clerkUserId = String(req.headers["x-clerk-user-id"] ?? "");
  const email = String(req.headers["x-clerk-email"] ?? "");
  const fullName = String(req.headers["x-clerk-name"] ?? "");

  if (!clerkUserId || !email) throw new Error("Missing clerk user info");

  // 1. Check if this Clerk user already has an account (returning user)
  const existing = await pool.query(
    `SELECT u.id as user_id, m.org_id, m.role
     FROM users u JOIN memberships m ON m.user_id = u.id
     WHERE u.cognito_sub = $1 LIMIT 1`,
    [clerkUserId]
  );

  if (existing.rows.length > 0) {
    return { userId: existing.rows[0].user_id, orgId: existing.rows[0].org_id, role: existing.rows[0].role };
  }

  // 2. Check if this email already exists in the DB (invited or leftover from previous attempt)
  const existingByEmail = await pool.query(
    `SELECT u.id as user_id, m.org_id, m.role
     FROM users u LEFT JOIN memberships m ON m.user_id = u.id
     WHERE LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    [email]
  );

  if (existingByEmail.rows.length > 0 && existingByEmail.rows[0].org_id) {
    // User record exists with a membership — link Clerk account and return
    await pool.query(
      `UPDATE users SET cognito_sub = $1, full_name = COALESCE(NULLIF($2, ''), full_name) WHERE id = $3`,
      [clerkUserId, fullName || null, existingByEmail.rows[0].user_id]
    );
    await logActivity(existingByEmail.rows[0].org_id, existingByEmail.rows[0].user_id, "JOINED_VIA_INVITE", "USER", existingByEmail.rows[0].user_id, fullName || email);
    return { userId: existingByEmail.rows[0].user_id, orgId: existingByEmail.rows[0].org_id, role: existingByEmail.rows[0].role };
  }

  if (existingByEmail.rows.length > 0 && !existingByEmail.rows[0].org_id) {
    // User record exists but has no membership (orphaned) — update and create fresh org
    const userId = existingByEmail.rows[0].user_id;
    await pool.query(
      `UPDATE users SET cognito_sub = $1, full_name = COALESCE(NULLIF($2, ''), full_name) WHERE id = $3`,
      [clerkUserId, fullName || null, userId]
    );
    const orgResult = await pool.query(
      `INSERT INTO organisations (name) VALUES ($1) RETURNING id`,
      [`${fullName || email}'s Organisation`]
    );
    const orgId = orgResult.rows[0].id;
    await pool.query(
      `INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'ADMIN')`,
      [orgId, userId]
    );
    await logActivity(orgId, userId, "SIGNED_UP", "USER", userId, fullName || email);
    return { userId, orgId, role: "ADMIN" };
  }

  // 3. Brand new user — create org + user + membership
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
// Account & Team Management
// =======================
app.get("/account", async (req) => {
  const { orgId, userId } = getAuth(req);
  const orgRow = await pool.query(`SELECT id, name, logo_url, primary_color, plan, plan_seats, plan_expires_at, export_allowed_roles, created_at FROM organisations WHERE id = $1`, [orgId]);
  const userRow = await pool.query(`SELECT id, email, full_name, created_at FROM users WHERE id = $1`, [userId]);
  const memberCount = await pool.query(`SELECT COUNT(*)::int as count FROM memberships WHERE org_id = $1`, [orgId]);
  return {
    org: orgRow.rows[0] || null,
    user: userRow.rows[0] || null,
    memberCount: memberCount.rows[0]?.count || 0,
  };
});

app.put("/account", async (req) => {
  const { orgId, role } = getAuth(req);
  if (role !== "ADMIN") throw new Error("Forbidden: ADMIN only");
  const { name, primaryColor, exportAllowedRoles } = req.body as { name?: string; primaryColor?: string; exportAllowedRoles?: string[] };
  
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;
  
  if (name?.trim()) { updates.push(`name = $${idx++}`); values.push(name.trim()); }
  if (primaryColor) { updates.push(`primary_color = $${idx++}`); values.push(primaryColor); }
  if (exportAllowedRoles) { updates.push(`export_allowed_roles = $${idx++}`); values.push(exportAllowedRoles); }
  
  if (updates.length === 0) throw new Error("No changes provided");
  
  values.push(orgId);
  await pool.query(`UPDATE organisations SET ${updates.join(", ")} WHERE id = $${idx}`, values);
  return { ok: true };
});

// POST /account/logo — Upload org logo
app.post("/account/logo", async (req) => {
  const { orgId, role } = getAuth(req);
  if (role !== "ADMIN") throw new Error("Forbidden: ADMIN only");
  
  const data = await req.file();
  if (!data) throw new Error("No file uploaded");
  
  const buffer = await data.toBuffer();
  if (buffer.length > 2 * 1024 * 1024) throw new Error("Logo must be under 2MB");
  
  const ext = data.filename.split(".").pop()?.toLowerCase() || "png";
  if (!["png", "jpg", "jpeg", "svg", "webp"].includes(ext)) throw new Error("Invalid file type. Use PNG, JPG, SVG, or WebP.");
  
  const filename = `logo_${orgId}.${ext}`;
  const filepath = join(UPLOAD_DIR, filename);
  await writeFile(filepath, buffer);
  
  const logoUrl = `/uploads/${filename}`;
  await pool.query(`UPDATE organisations SET logo_url = $1 WHERE id = $2`, [logoUrl, orgId]);
  
  return { logoUrl };
});

// GET /account/org-public — Get org branding (for sidebar, no auth needed for same-org)
app.get("/account/org-branding", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(`SELECT name, logo_url, primary_color, plan FROM organisations WHERE id = $1`, [orgId]);
  return r.rows[0] || {};
});

app.get("/account/members", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.created_at, m.role,
            CASE WHEN u.password_hash IS NULL OR u.password_hash = '' THEN 'PENDING' ELSE 'ACTIVE' END as status
     FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.org_id = $1
     ORDER BY m.role ASC, u.full_name ASC`,
    [orgId]
  );
  return r.rows;
});

app.put("/account/members/:memberId", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role !== "ADMIN") throw new Error("Forbidden: ADMIN only");
  const { memberId } = req.params as { memberId: string };
  const { role: newRole } = req.body as { role?: string };
  if (!newRole || !["ADMIN", "AUDITOR", "VIEWER"].includes(newRole)) throw new Error("Invalid role");
  if (memberId === userId) throw new Error("Cannot change your own role");
  await pool.query(
    `UPDATE memberships SET role = $1 WHERE org_id = $2 AND user_id = $3`,
    [newRole, orgId, memberId]
  );
  await logActivity(orgId, userId, "ROLE_CHANGED", "USER", memberId, `Role → ${newRole}`);
  return { ok: true };
});

app.delete("/account/members/:memberId", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role !== "ADMIN") throw new Error("Forbidden: ADMIN only");
  const { memberId } = req.params as { memberId: string };
  if (memberId === userId) throw new Error("Cannot remove yourself");
  await pool.query(`DELETE FROM memberships WHERE org_id = $1 AND user_id = $2`, [orgId, memberId]);
  await logActivity(orgId, userId, "MEMBER_REMOVED", "USER", memberId, "");
  return { ok: true };
});

app.post("/account/invite", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role !== "ADMIN") throw new Error("Forbidden: ADMIN only");
  const { email, role: inviteRole, fullName: inviteName } = req.body as { email?: string; role?: string; fullName?: string };
  if (!email?.trim()) throw new Error("Email required");
  if (!inviteRole || !["ADMIN", "AUDITOR", "VIEWER"].includes(inviteRole)) throw new Error("Invalid role");

  const cleanEmail = email.trim().toLowerCase();

  // Check if user already exists
  const existingUser = await pool.query(`SELECT id, password_hash FROM users WHERE email = $1`, [cleanEmail]);
  let targetUserId: string;

  if (existingUser.rows.length > 0) {
    targetUserId = existingUser.rows[0].id;
    // Check if already a member
    const existingMember = await pool.query(
      `SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = $2`, [orgId, targetUserId]
    );
    if (existingMember.rows.length > 0) throw new Error("User is already a member");

    // Update name if provided and user has no name
    if (inviteName) {
      await pool.query(`UPDATE users SET full_name = COALESCE(full_name, $1) WHERE id = $2`, [inviteName, targetUserId]);
    }
  } else {
    // Create user with email_verified = true (invited by admin)
    const newUser = await pool.query(
      `INSERT INTO users (email, full_name, email_verified) VALUES ($1, $2, true) RETURNING id`,
      [cleanEmail, inviteName || null]
    );
    targetUserId = newUser.rows[0].id;
  }

  await pool.query(
    `INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)`,
    [orgId, targetUserId, inviteRole]
  );

  // Generate a password setup token (same mechanism as forgot password)
  const setupToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days for invite

  // Invalidate any existing tokens
  await pool.query(`UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false`, [targetUserId]);
  await pool.query(
    `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [targetUserId, setupToken, expiresAt]
  );

  // Send invite email with set password link
  const inviter = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [userId]);
  const orgName = await pool.query(`SELECT name FROM organisations WHERE id = $1`, [orgId]);
  const inviterName = inviter.rows[0]?.full_name || "A team member";
  const orgDisplayName = orgName.rows[0]?.name || "an organisation";
  const setupUrl = `https://complyva.com/reset-password?token=${setupToken}`;

  const hasPassword = existingUser.rows.length > 0 && existingUser.rows[0].password_hash;

  const { sendEmail } = await import("./emails");
  await sendEmail(
    cleanEmail,
    `You've been invited to ${orgDisplayName} on Complyva`,
    `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; color: #1a1a1a;">
      <div style="border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 24px;">
        <img src="https://complyva.com/logo.png" alt="Complyva" style="height: 22px;" />
      </div>
      <h2 style="color: #111; font-size: 18px; margin: 0 0 8px;">You've been invited!</h2>
      <p style="color: #374151;">${inviterName} has invited you to join <strong>${orgDisplayName}</strong> on Complyva as <strong>${inviteRole}</strong>.</p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <div style="font-size: 13px; color: #6b7280;">Your account email</div>
        <div style="font-size: 15px; font-weight: 600; color: #111;">${cleanEmail}</div>
      </div>
      ${hasPassword
        ? `<p style="color: #374151;">You already have a Complyva account. Just sign in to access your new organisation.</p>
           <div style="text-align: center; margin: 28px 0;">
             <a href="https://complyva.com/sign-in" style="background: #111; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Sign In</a>
           </div>`
        : `<p style="color: #374151;">To get started, set your password by clicking the button below:</p>
           <div style="text-align: center; margin: 28px 0;">
             <a href="${setupUrl}" style="background: #111; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Set Your Password</a>
           </div>
           <p style="color: #6b7280; font-size: 13px;">This link expires in 7 days.</p>`
      }
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 11px; margin: 0;">Automated notification from Complyva.</p>
      </div>
    </div>
    `
  );

  await logActivity(orgId, userId, "MEMBER_INVITED", "USER", targetUserId, `${cleanEmail} as ${inviteRole}`);
  return { ok: true };
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

  if (!["CERTIFICATION", "RISK", "AUDIT", "FINDING", "INCIDENT", "CHANGE", "NC", "CAPA", "ASSET", "DOCUMENT"].includes(entityType)) throw new Error("Invalid entity type");
  if (!entityId) throw new Error("Missing entity ID");

  const data = await req.file();
  if (!data) throw new Error("No file uploaded");

  const ALLOWED_EVIDENCE_MIMES = new Set([
    "application/pdf",
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel", "application/msword",
    "text/plain", "text/csv",
  ]);

  if (!ALLOWED_EVIDENCE_MIMES.has(data.mimetype)) {
    throw new Error(`File type '${data.mimetype}' is not allowed. Accepted types: PDF, images, Office documents, CSV, and plain text.`);
  }

  const buffer = await data.toBuffer();
  const fileName = data.filename.replace(/[^a-zA-Z0-9._\-\s]/g, "_").slice(0, 255);
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
  const filePath = safeFilePath(file.s3_key);
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
  status: z.enum(["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "PENDING_APPROVAL", "CLOSED"]).optional(),
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

// --- Incident Cross-Register Links ---

app.post("/incidents/:id/send-to-risk", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const dup = await pool.query(`SELECT 1 FROM cross_links WHERE org_id = $1 AND source_type = 'INCIDENT' AND source_id = $2 AND target_type = 'RISK' AND link_type = 'GENERATED'`, [orgId, id]);
  if (dup.rows.length > 0) throw new Error("This incident has already been sent to the Risk Register");
  const f = await pool.query(`SELECT * FROM incidents WHERE id = $1 AND org_id = $2`, [id, orgId]);
  if (f.rows.length === 0) throw new Error("Not found");
  const inc = f.rows[0];
  const sevMap: Record<string, number> = { LOW: 2, MEDIUM: 3, HIGH: 4, CRITICAL: 5 };
  const score = sevMap[inc.severity] ?? 3;
  const inherentScore = score * score;
  const r = await pool.query(
    `INSERT INTO risks (org_id, title, description, category, likelihood, impact, inherent_score, status, owner_user_id, treatment_plan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING_REVIEW',$8,$9) RETURNING *`,
    [orgId, `[From Incident] ${inc.title}`, inc.description || `Originated from incident: ${inc.title}`,
     "Incident", score, score, inherentScore, userId, inc.corrective_action || null]
  );
  await logActivity(orgId, userId, "SENT_TO_RISK", "INCIDENT", id, inc.title, `Created Risk: ${r.rows[0].id}`);
  await pool.query(
    `INSERT INTO cross_links (org_id, source_type, source_id, source_title, target_type, target_id, target_title, link_type, created_by)
     VALUES ($1,'INCIDENT',$2,$3,'RISK',$4,$5,'GENERATED',$6)`,
    [orgId, id, inc.title, r.rows[0].id, r.rows[0].title, userId]
  );
  return r.rows[0];
});

app.post("/incidents/:id/send-to-nc", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const dup = await pool.query(`SELECT 1 FROM cross_links WHERE org_id = $1 AND source_type = 'INCIDENT' AND source_id = $2 AND target_type = 'NC' AND link_type = 'GENERATED'`, [orgId, id]);
  if (dup.rows.length > 0) throw new Error("This incident has already been sent to Non-Conformities");
  const f = await pool.query(`SELECT * FROM incidents WHERE id = $1 AND org_id = $2`, [id, orgId]);
  if (f.rows.length === 0) throw new Error("Not found");
  const inc = f.rows[0];
  const sevMap: Record<string, string> = { LOW: "MINOR", MEDIUM: "MINOR", HIGH: "MAJOR", CRITICAL: "CRITICAL" };
  const r = await pool.query(
    `INSERT INTO nonconformities (org_id, title, description, source_type, source_ref_id, severity, asset_id, root_cause, raised_by, status)
     VALUES ($1,$2,$3,'INCIDENT',$4,$5,$6,$7,$8,'OPEN') RETURNING *`,
    [orgId, `[From Incident] ${inc.title}`, inc.description || `Originated from incident: ${inc.title}`,
     id, sevMap[inc.severity] ?? "MINOR", inc.asset_id || null, inc.root_cause || null, inc.reported_by || null]
  );
  await logActivity(orgId, userId, "SENT_TO_NC", "INCIDENT", id, inc.title, `Created NC: ${r.rows[0].id}`);
  await pool.query(
    `INSERT INTO cross_links (org_id, source_type, source_id, source_title, target_type, target_id, target_title, link_type, created_by)
     VALUES ($1,'INCIDENT',$2,$3,'NC',$4,$5,'GENERATED',$6)`,
    [orgId, id, inc.title, r.rows[0].id, r.rows[0].title, userId]
  );
  return r.rows[0];
});

// --- NC Cross-Register Links ---

app.post("/nonconformities/:id/send-to-capa", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const dup = await pool.query(`SELECT 1 FROM cross_links WHERE org_id = $1 AND source_type = 'NC' AND source_id = $2 AND target_type = 'CAPA' AND link_type = 'GENERATED'`, [orgId, id]);
  if (dup.rows.length > 0) throw new Error("This non-conformity has already been sent to CAPAs");
  const f = await pool.query(`SELECT * FROM nonconformities WHERE id = $1 AND org_id = $2`, [id, orgId]);
  if (f.rows.length === 0) throw new Error("Not found");
  const nc = f.rows[0];
  const sevMap: Record<string, string> = { OBSERVATION: "LOW", MINOR: "MEDIUM", MAJOR: "HIGH", CRITICAL: "CRITICAL" };
  const r = await pool.query(
    `INSERT INTO capas (org_id, title, description, capa_type, source_type, source_ref_id, asset_id, root_cause, root_cause_category, raised_by, assigned_to, priority, status, owner_user_id)
     VALUES ($1,$2,$3,'CORRECTIVE','NC',$4,$5,$6,$7,$8,$9,$10,'OPEN',$11) RETURNING *`,
    [orgId, `[From NC] ${nc.title}`, nc.description || `Originated from non-conformity: ${nc.title}`,
     id, nc.asset_id || null, nc.root_cause || null, null,
     nc.raised_by || null, nc.assigned_to || null, sevMap[nc.severity] ?? "MEDIUM", userId]
  );
  await logActivity(orgId, userId, "SENT_TO_CAPA", "NC", id, nc.title, `Created CAPA: ${r.rows[0].id}`);
  await pool.query(
    `INSERT INTO cross_links (org_id, source_type, source_id, source_title, target_type, target_id, target_title, link_type, created_by)
     VALUES ($1,'NC',$2,$3,'CAPA',$4,$5,'GENERATED',$6)`,
    [orgId, id, nc.title, r.rows[0].id, r.rows[0].title, userId]
  );
  return r.rows[0];
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
  status: z.enum(["DRAFT", "SUBMITTED", "PENDING_APPROVAL", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED", "ROLLED_BACK", "CANCELLED"]).optional(),
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
  status: z.enum(["OPEN", "UNDER_INVESTIGATION", "CONTAINMENT", "CORRECTIVE_ACTION", "VERIFIED", "PENDING_APPROVAL", "CLOSED"]).optional(),
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
  status: z.enum(["OPEN", "UNDER_INVESTIGATION", "ACTION_DEFINED", "IN_PROGRESS", "PENDING_VERIFICATION", "PENDING_APPROVAL", "CLOSED", "REOPENED"]).optional(),
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

// =======================
// Cross-Links
// =======================
app.get("/cross-links/:entityType/:entityId", async (req) => {
  const { orgId } = getAuth(req);
  const { entityType, entityId } = req.params as { entityType: string; entityId: string };
  const r = await pool.query(
    `SELECT * FROM cross_links
     WHERE org_id = $1 AND (
       (source_type = $2 AND source_id = $3) OR
       (target_type = $2 AND target_id = $3)
     )
     ORDER BY created_at DESC`,
    [orgId, entityType, entityId]
  );
  return r.rows;
});

app.get("/cross-links", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `SELECT * FROM cross_links WHERE org_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [orgId]
  );
  return r.rows;
});

// =======================
// Super Admin — Plan Management (protected by secret key)
// =======================
if (!process.env.ADMIN_SECRET) {
  throw new Error("FATAL: ADMIN_SECRET environment variable is not set. Generate one with: openssl rand -hex 32");
}
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function requireAdmin(req: any) {
  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_SECRET) throw new Error("Unauthorized");
}

// GET /admin/orgs — List all organisations with plan info
app.get("/admin/orgs", async (req) => {
  requireAdmin(req);
  const r = await pool.query(
    `SELECT o.id, o.name, o.plan, o.plan_seats, o.extra_seats, o.billing_cycle, o.plan_expires_at, o.trial_started_at, o.created_at,
            (SELECT COUNT(*)::int FROM memberships WHERE org_id = o.id) as member_count
     FROM organisations o ORDER BY o.created_at DESC`
  );
  return r.rows;
});

// PUT /admin/orgs/:orgId/plan — Update an org's plan
app.put("/admin/orgs/:orgId/plan", async (req) => {
  requireAdmin(req);
  const { orgId } = req.params as { orgId: string };
  const { plan, planSeats, extraSeats, billingCycle, expiresAt } = req.body as {
    plan?: string; planSeats?: number; extraSeats?: number; billingCycle?: string; expiresAt?: string;
  };
  
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;
  
  if (plan) { updates.push(`plan = $${idx++}`); values.push(plan); }
  if (planSeats !== undefined) { updates.push(`plan_seats = $${idx++}`); values.push(planSeats); }
  if (extraSeats !== undefined) { updates.push(`extra_seats = $${idx++}`); values.push(extraSeats); }
  if (billingCycle) { updates.push(`billing_cycle = $${idx++}`); values.push(billingCycle); }
  if (expiresAt) { updates.push(`plan_expires_at = $${idx++}`); values.push(expiresAt); }
  if (expiresAt === null) { updates.push(`plan_expires_at = NULL`); }
  
  if (updates.length === 0) throw new Error("No changes");
  
  values.push(orgId);
  await pool.query(`UPDATE organisations SET ${updates.join(", ")} WHERE id = $${idx}`, values);
  return { ok: true };
});

// POST /admin/create-org — Create a new org + admin user (for onboarding customers)
app.post("/admin/create-org", async (req) => {
  requireAdmin(req);
  const schema = z.object({
    orgName: z.string().min(1),
    adminEmail: z.string().email(),
    adminName: z.string().min(1),
    plan: z.enum(["trial", "pro", "enterprise"]).default("trial"),
    trialDays: z.number().default(7),
  });
  const p = schema.parse(req.body);
  const email = p.adminEmail.toLowerCase().trim();
  
  // Check if user exists
  const existing = await pool.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [email]);
  
  let userId: string;
  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;
  } else {
    const r = await pool.query(
      `INSERT INTO users (email, full_name) VALUES ($1, $2) RETURNING id`,
      [email, p.adminName]
    );
    userId = r.rows[0].id;
  }
  
  // Create org
  const expiresAt = p.plan === "trial" ? new Date(Date.now() + p.trialDays * 24 * 60 * 60 * 1000).toISOString() : null;
  const orgResult = await pool.query(
    `INSERT INTO organisations (name, plan, plan_seats, trial_started_at, plan_expires_at)
     VALUES ($1, $2, $3, NOW(), $4) RETURNING id`,
    [p.orgName, p.plan, p.plan === "enterprise" ? 999 : 5, expiresAt]
  );
  const orgId = orgResult.rows[0].id;
  
  await pool.query(`INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'ADMIN')`, [orgId, userId]);
  
  // Send welcome email
  const { sendEmail } = await import("./emails");
  await sendEmail(
    email,
    `Welcome to Complyva — Your account is ready`,
    `
    <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
      <h2 style="color: #111;">Welcome to Complyva!</h2>
      <p style="color: #374151;">Hi ${p.adminName},</p>
      <p style="color: #374151;">Your organisation <strong>${p.orgName}</strong> has been created on Complyva. You're the admin.</p>
      ${p.plan === "trial" ? `<p style="color: #374151;">You have a <strong>${p.trialDays}-day free trial</strong>. Enjoy full access to all features.</p>` : ""}
      <div style="text-align: center; margin: 28px 0;">
        <a href="https://complyva.com/sign-up" style="background: #111; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Set Up Your Account</a>
      </div>
      <p style="color: #6b7280; font-size: 13px;">Sign up with <strong>${email}</strong> to get started.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">— Complyva</p>
    </div>
    `
  );
  
  return { ok: true, orgId, userId };
});

// DELETE /admin/users/:userId — Delete a user (remove from all orgs)
app.delete("/admin/users/:userId", async (req) => {
  requireAdmin(req);
  const { userId } = req.params as { userId: string };
  
  // Clean up all user data
  await pool.query(`DELETE FROM login_codes WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM trusted_devices WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM password_resets WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM memberships WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  
  return { ok: true, deleted: "user" };
});

// DELETE /admin/orgs/:orgId — Delete an entire organisation and all its data
app.delete("/admin/orgs/:orgId", async (req) => {
  requireAdmin(req);
  const { orgId } = req.params as { orgId: string };
  
  // Get all users in this org
  const members = await pool.query(`SELECT user_id FROM memberships WHERE org_id = $1`, [orgId]);
  const userIds = members.rows.map((r: any) => r.user_id);
  
  // Delete org data — safe delete (skip tables that don't exist)
  const safeDel = async (table: string) => {
    try { await pool.query(`DELETE FROM ${table} WHERE org_id = $1`, [orgId]); } catch {}
  };
  await safeDel("activity_log");
  await safeDel("cross_links");
  await safeDel("evidence_files");
  await safeDel("audit_findings");
  await safeDel("audits");
  await safeDel("risks");
  await safeDel("certifications");
  await safeDel("assets");
  await safeDel("incidents");
  await safeDel("changes");
  await safeDel("nonconformities");
  await safeDel("capas");
  await safeDel("approvals");
  await safeDel("document_versions");
  await safeDel("documents");
  await pool.query(`DELETE FROM memberships WHERE org_id = $1`, [orgId]);
  await pool.query(`DELETE FROM organisations WHERE id = $1`, [orgId]);
  
  // Delete users who have no other memberships
  for (const uid of userIds) {
    const other = await pool.query(`SELECT 1 FROM memberships WHERE user_id = $1 LIMIT 1`, [uid]);
    if (other.rows.length === 0) {
      await pool.query(`DELETE FROM login_codes WHERE user_id = $1`, [uid]);
      await pool.query(`DELETE FROM trusted_devices WHERE user_id = $1`, [uid]);
      await pool.query(`DELETE FROM password_resets WHERE user_id = $1`, [uid]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [uid]);
    }
  }
  
  return { ok: true, deleted: "organisation", usersRemoved: userIds.length };
});

// GET /admin/orgs/:orgId/members — List members of an org
app.get("/admin/orgs/:orgId/members", async (req) => {
  requireAdmin(req);
  const { orgId } = req.params as { orgId: string };
  const r = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.created_at, u.password_hash IS NOT NULL as has_password, m.role
     FROM users u JOIN memberships m ON m.user_id = u.id WHERE m.org_id = $1 ORDER BY m.role, u.full_name`,
    [orgId]
  );
  return r.rows;
});

// =======================
// Document & Policy Register
// =======================

const DocSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  docType: z.enum(["POLICY", "PROCEDURE", "STANDARD", "GUIDELINE", "TEMPLATE", "SOP", "WORK_INSTRUCTION"]).optional(),
  category: z.string().optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "SUPERSEDED", "ARCHIVED"]).optional(),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]).optional(),
  owner: z.string().optional(),
  reviewer: z.string().optional(),
  approver: z.string().optional(),
  effectiveDate: z.string().optional(),
  nextReviewDate: z.string().optional(),
  linkedFrameworks: z.string().optional(),
});

// GET /documents
app.get("/documents", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `SELECT d.*, 
      (SELECT count(*)::int FROM document_versions dv WHERE dv.document_id = d.id) as version_count
     FROM documents d WHERE d.org_id = $1 ORDER BY d.created_at DESC`,
    [orgId]
  );
  return r.rows;
});

// GET /documents/:id
app.get("/documents/:id", async (req) => {
  const { orgId } = getAuth(req);
  const { id } = req.params as { id: string };
  const r = await pool.query(`SELECT * FROM documents WHERE id = $1 AND org_id = $2`, [id, orgId]);
  if (r.rows.length === 0) throw new Error("Document not found");
  return r.rows[0];
});

// POST /documents
app.post("/documents", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const p = DocSchema.parse(req.body);
  const r = await pool.query(
    `INSERT INTO documents (org_id, title, description, doc_type, category, status, classification, owner, reviewer, approver, effective_date, next_review_date, linked_frameworks, owner_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [orgId, p.title, p.description||null, p.docType||"POLICY", p.category||null, p.status||"DRAFT", p.classification||"INTERNAL",
     p.owner||null, p.reviewer||null, p.approver||null, p.effectiveDate||null, p.nextReviewDate||null, p.linkedFrameworks||null, userId]
  );
  await logActivity(orgId, userId, "CREATED", "DOCUMENT", r.rows[0].id, p.title);
  return r.rows[0];
});

// PUT /documents/:id
app.put("/documents/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const p = DocSchema.partial().parse(cleanBody(typeof req.body === "string" ? JSON.parse(req.body) : req.body));
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (p.title !== undefined) { fields.push(`title = $${idx++}`); values.push(p.title); }
  if (p.description !== undefined) { fields.push(`description = $${idx++}`); values.push(p.description); }
  if (p.docType !== undefined) { fields.push(`doc_type = $${idx++}`); values.push(p.docType); }
  if (p.category !== undefined) { fields.push(`category = $${idx++}`); values.push(p.category); }
  if (p.status !== undefined) { fields.push(`status = $${idx++}`); values.push(p.status); }
  if (p.classification !== undefined) { fields.push(`classification = $${idx++}`); values.push(p.classification); }
  if (p.owner !== undefined) { fields.push(`owner = $${idx++}`); values.push(p.owner); }
  if (p.reviewer !== undefined) { fields.push(`reviewer = $${idx++}`); values.push(p.reviewer); }
  if (p.approver !== undefined) { fields.push(`approver = $${idx++}`); values.push(p.approver); }
  if (p.effectiveDate !== undefined) { fields.push(`effective_date = $${idx++}`); values.push(p.effectiveDate || null); }
  if (p.nextReviewDate !== undefined) { fields.push(`next_review_date = $${idx++}`); values.push(p.nextReviewDate || null); }
  if (p.linkedFrameworks !== undefined) { fields.push(`linked_frameworks = $${idx++}`); values.push(p.linkedFrameworks); }

  if (fields.length === 0) throw new Error("Nothing to update");
  fields.push(`updated_at = NOW()`);
  values.push(id, orgId);

  const r = await pool.query(
    `UPDATE documents SET ${fields.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
    values
  );
  if (r.rows.length === 0) throw new Error("Document not found");
  await logActivity(orgId, userId, "UPDATED", "DOCUMENT", id, r.rows[0].title);
  return r.rows[0];
});

// DELETE /documents/:id
app.delete("/documents/:id", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role !== "ADMIN") throw new Error("Forbidden");
  const { id } = req.params as { id: string };
  const doc = await pool.query(`SELECT title FROM documents WHERE id = $1 AND org_id = $2`, [id, orgId]);
  if (doc.rows.length === 0) throw new Error("Document not found");
  // Delete version files
  const versions = await pool.query(`SELECT file_path FROM document_versions WHERE document_id = $1`, [id]);
  for (const v of versions.rows) {
    try { await unlink(safeFilePath(v.file_path)); } catch {}
  }
  await pool.query(`DELETE FROM document_versions WHERE document_id = $1`, [id]);
  await pool.query(`DELETE FROM documents WHERE id = $1 AND org_id = $2`, [id, orgId]);
  await logActivity(orgId, userId, "DELETED", "DOCUMENT", id, doc.rows[0].title);
  return { ok: true };
});

// POST /documents/:id/versions — Upload a new version
app.post("/documents/:id/versions", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");
  const { id } = req.params as { id: string };

  const doc = await pool.query(`SELECT * FROM documents WHERE id = $1 AND org_id = $2`, [id, orgId]);
  if (doc.rows.length === 0) throw new Error("Document not found");

  const data = await req.file();
  if (!data) throw new Error("No file uploaded");

  const buffer = await data.toBuffer();
  const fileName = data.filename;
  const fileSize = buffer.length;
  const storageKey = `${orgId}/DOCUMENT/${id}/${Date.now()}-${fileName}`;
  const filePath = join(UPLOAD_DIR, storageKey);

  await mkdir(join(UPLOAD_DIR, orgId, "DOCUMENT", id), { recursive: true });
  await writeFile(filePath, buffer);

  const query = req.query as { changeNotes?: string; versionLabel?: string };
  const versionLabel = query.versionLabel || String(Number(doc.rows[0].current_version || 0) + 1);

  await pool.query(
    `INSERT INTO document_versions (document_id, org_id, version_label, file_name, file_path, file_size, uploaded_by, change_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, orgId, versionLabel, fileName, storageKey, fileSize, userId, query.changeNotes || null]
  );

  await pool.query(`UPDATE documents SET current_version = $1, updated_at = NOW() WHERE id = $2`, [versionLabel, id]);
  await logActivity(orgId, userId, "UPLOADED_VERSION", "DOCUMENT", id, doc.rows[0].title, `Version ${versionLabel}`);

  return { ok: true, version: versionLabel };
});

// GET /documents/:id/versions
app.get("/documents/:id/versions", async (req) => {
  const { orgId } = getAuth(req);
  const { id } = req.params as { id: string };
  const r = await pool.query(
    `SELECT dv.*, u.full_name as uploaded_by_name
     FROM document_versions dv LEFT JOIN users u ON u.id = dv.uploaded_by
     WHERE dv.document_id = $1 AND dv.org_id = $2 ORDER BY dv.created_at DESC`,
    [id, orgId]
  );
  return r.rows;
});

// GET /documents/versions/:versionId/download
app.get("/documents/versions/:versionId/download", async (req, reply) => {
  const { orgId } = getAuth(req);
  const { versionId } = req.params as { versionId: string };
  const r = await pool.query(
    `SELECT file_name, file_path FROM document_versions WHERE id = $1 AND org_id = $2`,
    [versionId, orgId]
  );
  if (r.rows.length === 0) throw new Error("Version not found");
  const filePath = safeFilePath(r.rows[0].file_path);
  const buffer = await readFile(filePath);
  reply.header("Content-Disposition", `attachment; filename="${r.rows[0].file_name}"`);
  reply.header("Content-Type", "application/octet-stream");
  return reply.send(buffer);
});

// =======================
// Approvals Workflow
// =======================

const APPROVABLE_TYPES = ["CHANGE", "CAPA", "INCIDENT", "NC"];
const ENTITY_TABLE: Record<string, string> = { CHANGE: "changes", CAPA: "capas", INCIDENT: "incidents", NC: "nonconformities" };
const ENTITY_FINAL_STATUS: Record<string, string> = { CHANGE: "APPROVED", CAPA: "CLOSED", INCIDENT: "CLOSED", NC: "CLOSED" };

// GET /approvals — List approvals for org
app.get("/approvals", async (req) => {
  const { orgId } = getAuth(req);
  const query = req.query as { status?: string };
  
  let sql = `SELECT a.*, 
    u1.full_name as requested_by_name, u1.email as requested_by_email,
    u2.full_name as decided_by_name
    FROM approvals a
    LEFT JOIN users u1 ON u1.id = a.requested_by
    LEFT JOIN users u2 ON u2.id = a.decided_by
    WHERE a.org_id = $1`;
  const values: any[] = [orgId];
  
  if (query.status) {
    sql += ` AND a.status = $2`;
    values.push(query.status);
  }
  sql += ` ORDER BY a.created_at DESC`;
  
  const r = await pool.query(sql, values);
  return r.rows;
});

// GET /approvals/pending/count — Count pending approvals (for sidebar badge)
app.get("/approvals/pending/count", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `SELECT count(*)::int as count FROM approvals WHERE org_id = $1 AND status = 'PENDING'`,
    [orgId]
  );
  return { count: r.rows[0]?.count ?? 0 };
});

// POST /approvals/submit — Submit an item for approval
app.post("/approvals/submit", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden: Viewers cannot submit for approval");
  
  const schema = z.object({
    entityType: z.enum(["CHANGE", "CAPA", "INCIDENT", "NC"]),
    entityId: z.string().uuid(),
  });
  const p = schema.parse(req.body);
  
  const table = ENTITY_TABLE[p.entityType];
  
  // Get entity and verify ownership
  const entity = await pool.query(
    `SELECT id, title, status FROM ${table} WHERE id = $1 AND org_id = $2`,
    [p.entityId, orgId]
  );
  if (entity.rows.length === 0) throw new Error("Item not found");
  
  const item = entity.rows[0];
  
  // Check no pending approval already exists
  const existing = await pool.query(
    `SELECT id FROM approvals WHERE entity_type = $1 AND entity_id = $2 AND status = 'PENDING'`,
    [p.entityType, p.entityId]
  );
  if (existing.rows.length > 0) throw new Error("This item already has a pending approval request");
  
  // Create approval request
  await pool.query(
    `INSERT INTO approvals (org_id, entity_type, entity_id, entity_title, status, requested_by, previous_status)
     VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)`,
    [orgId, p.entityType, p.entityId, item.title, userId, item.status]
  );
  
  // Update entity status to PENDING_APPROVAL
  await pool.query(`UPDATE ${table} SET status = 'PENDING_APPROVAL' WHERE id = $1`, [p.entityId]);
  
  await logActivity(orgId, userId, "APPROVAL_REQUESTED", p.entityType, p.entityId, item.title);
  
  // Email all admins
  const admins = await pool.query(
    `SELECT u.email, u.full_name FROM users u JOIN memberships m ON m.user_id = u.id
     WHERE m.org_id = $1 AND m.role = 'ADMIN' AND u.id != $2 AND u.email_verified = true AND u.password_hash IS NOT NULL`,
    [orgId, userId]
  );
  const requester = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [userId]);
  const requesterName = requester.rows[0]?.full_name || "A team member";
  
  const { sendEmail } = await import("./emails");
  for (const admin of admins.rows) {
    await sendEmail(
      admin.email,
      `Approval needed: ${item.title}`,
      `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
        <div style="border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 24px;">
          <img src="https://complyva.com/logo.png" alt="Complyva" style="height: 22px;" />
        </div>
        <h2 style="color: #111; font-size: 18px; margin: 0 0 8px;">Approval Required</h2>
        <p style="color: #374151;">Hi ${admin.full_name || "there"},</p>
        <p style="color: #374151;"><strong>${requesterName}</strong> has submitted an item for your approval:</p>
        <div style="background: #f9fafb; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <div style="font-weight: 700; font-size: 16px; color: #111;">${item.title}</div>
          <div style="color: #6b7280; font-size: 13px; margin-top: 4px;">Type: ${p.entityType} | Previous status: ${item.status}</div>
        </div>
        <p style="color: #374151;"><a href="https://complyva.com/approvals" style="color: #0891b2; font-weight: 600;">Review and decide in Complyva</a></p>
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">Automated notification from Complyva.</p>
        </div>
      </div>
      `
    );
  }
  
  return { ok: true };
});

// POST /approvals/:id/decide — Approve or reject
app.post("/approvals/:id/decide", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role !== "ADMIN") throw new Error("Forbidden: Only admins can approve or reject");
  
  const { id } = req.params as { id: string };
  const schema = z.object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    comment: z.string().optional(),
  });
  const p = schema.parse(req.body);
  
  // Get approval
  const approval = await pool.query(
    `SELECT * FROM approvals WHERE id = $1 AND org_id = $2 AND status = 'PENDING'`,
    [id, orgId]
  );
  if (approval.rows.length === 0) throw new Error("Approval not found or already decided");
  
  const appr = approval.rows[0];
  
  // Can't approve your own submission
  if (appr.requested_by === userId) throw new Error("You cannot approve your own submission");
  
  const table = ENTITY_TABLE[appr.entity_type];
  const newStatus = p.decision === "APPROVED" ? ENTITY_FINAL_STATUS[appr.entity_type] : appr.previous_status;
  
  // Update approval record
  await pool.query(
    `UPDATE approvals SET status = $1, decided_by = $2, comment = $3, decided_at = NOW() WHERE id = $4`,
    [p.decision, userId, p.comment || null, id]
  );
  
  // Update entity status
  await pool.query(`UPDATE ${table} SET status = $1 WHERE id = $2`, [newStatus, appr.entity_id]);
  
  await logActivity(orgId, userId, p.decision === "APPROVED" ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED", appr.entity_type, appr.entity_id, appr.entity_title);
  
  // Email the requester
  const requester = await pool.query(`SELECT email, full_name FROM users WHERE id = $1`, [appr.requested_by]);
  const decider = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [userId]);
  
  if (requester.rows.length > 0) {
    const { sendEmail } = await import("./emails");
    const isApproved = p.decision === "APPROVED";
    await sendEmail(
      requester.rows[0].email,
      `${isApproved ? "Approved" : "Rejected"}: ${appr.entity_title}`,
      `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
        <div style="border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 24px;">
          <img src="https://complyva.com/logo.png" alt="Complyva" style="height: 22px;" />
        </div>
        <h2 style="color: ${isApproved ? "#16a34a" : "#dc2626"}; font-size: 18px; margin: 0 0 8px;">${isApproved ? "Approved" : "Rejected"}</h2>
        <p style="color: #374151;">Hi ${requester.rows[0].full_name || "there"},</p>
        <p style="color: #374151;">Your approval request has been <strong>${isApproved ? "approved" : "rejected"}</strong> by ${decider.rows[0]?.full_name || "an admin"}:</p>
        <div style="background: ${isApproved ? "#f0fdf4" : "#fef2f2"}; border-left: 4px solid ${isApproved ? "#16a34a" : "#dc2626"}; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <div style="font-weight: 700; font-size: 16px; color: #111;">${appr.entity_title}</div>
          <div style="color: #6b7280; font-size: 13px; margin-top: 4px;">Type: ${appr.entity_type} | New status: ${newStatus}</div>
          ${p.comment ? `<div style="color: #374151; font-size: 13px; margin-top: 8px; font-style: italic;">"${p.comment}"</div>` : ""}
        </div>
        <p style="color: #374151;"><a href="https://complyva.com/${ENTITY_TABLE[appr.entity_type]}" style="color: #0891b2; font-weight: 600;">View in Complyva</a></p>
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">Automated notification from Complyva.</p>
        </div>
      </div>
      `
    );
  }
  
  return { ok: true, newStatus };
});

// GET /approvals/history/:entityType/:entityId — Get approval history for an item
app.get("/approvals/history/:entityType/:entityId", async (req) => {
  const { orgId } = getAuth(req);
  const { entityType, entityId } = req.params as { entityType: string; entityId: string };
  const r = await pool.query(
    `SELECT a.*, u1.full_name as requested_by_name, u2.full_name as decided_by_name
     FROM approvals a
     LEFT JOIN users u1 ON u1.id = a.requested_by
     LEFT JOIN users u2 ON u2.id = a.decided_by
     WHERE a.org_id = $1 AND a.entity_type = $2 AND a.entity_id = $3
     ORDER BY a.created_at DESC`,
    [orgId, entityType, entityId]
  );
  return r.rows;
});

// --- Error handler ---
app.setErrorHandler((err, _req, reply) => {
  const raw = err instanceof Error ? err.message : "Unknown error";
  
  // Map technical errors to user-friendly messages
  const friendlyMessages: Record<string, string> = {
    "Not found": "The requested item could not be found.",
    "Forbidden": "You don't have permission to perform this action.",
    "No fields to update": "No changes were provided.",
    "Invalid or expired token": "Your session has expired. Please sign in again.",
    "No token": "Please sign in to continue.",
  };
  
  // Check for Zod validation errors
  if (raw.includes("Expected") || raw.includes("Required") || raw.includes("Invalid input")) {
    reply.status(400).send({ error: "Please check your input and try again." });
    return;
  }
  
  // Check for database errors
  if (raw.includes("duplicate key") || raw.includes("unique constraint")) {
    reply.status(400).send({ error: "This record already exists." });
    return;
  }
  if (raw.includes("violates foreign key")) {
    reply.status(400).send({ error: "Cannot complete this action due to linked records." });
    return;
  }
  if (raw.includes("connect ECONNREFUSED") || raw.includes("connection terminated")) {
    console.error("Database connection error:", raw);
    reply.status(500).send({ error: "Service temporarily unavailable. Please try again." });
    return;
  }
  
  const msg = friendlyMessages[raw] || raw;
  const status = raw === "Not found" ? 404 : raw === "Forbidden" ? 403 : 400;
  reply.status(status).send({ error: msg });
});

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" })
  .then(() => console.log(`API running on http://localhost:${port}`))
  .catch((err) => { app.log.error(err); process.exit(1); });

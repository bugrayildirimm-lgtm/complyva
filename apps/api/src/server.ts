import Fastify from "fastify";
import { z } from "zod";
import { pool } from "./db";
import { getAuth } from "./auth";
import multipart from "@fastify/multipart";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";

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
    "/certifications (GET, POST)",
    "/risks (GET, POST)",
    "/audits (GET, POST)",
    "/findings (POST)",
    "/audits/:id/findings (GET)",
    "/evidence/upload (POST)",
    "/evidence/:entityType/:entityId (GET)",
    "/evidence/download/:fileId (GET)",
    "/evidence/:fileId (DELETE)"
  ]
}));

app.get("/health", async () => ({ ok: true }));

app.get("/debug/tables", async () => {
  const r = await pool.query(`
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename;
  `);
  return r.rows;
});

// --- Dashboard summary ---
app.get("/dashboard/summary", async (req) => {
  const { orgId } = getAuth(req);

  const expiringSoon = await pool.query(
    `select count(*)::int as count
     from certifications
     where org_id = $1
       and expiry_date is not null
       and expiry_date <= (current_date + interval '60 days')
       and status = 'ACTIVE'`,
    [orgId]
  );

  const openRisks = await pool.query(
    `select count(*)::int as count
     from risks
     where org_id = $1
       and status in ('OPEN','IN_TREATMENT')`,
    [orgId]
  );

  const openFindings = await pool.query(
    `select count(*)::int as count
     from audit_findings
     where org_id = $1
       and status in ('OPEN','IN_PROGRESS')`,
    [orgId]
  );

  return {
    expiringSoon: expiringSoon.rows[0]?.count ?? 0,
    openRisks: openRisks.rows[0]?.count ?? 0,
    openFindings: openFindings.rows[0]?.count ?? 0
  };
});

// =======================
// Certifications
// =======================
const CreateCertification = z.object({
  name: z.string().min(2).max(200),
  frameworkType: z.string().max(200).optional(),
  issuingBody: z.string().max(200).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(5000).optional()
});

app.get("/certifications", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `select * from certifications
     where org_id = $1
     order by created_at desc
     limit 200`,
    [orgId]
  );
  return r.rows;
});

app.post("/certifications", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");

  const p = CreateCertification.parse(cleanBody(req.body));

  const r = await pool.query(
    `insert into certifications
      (org_id, name, framework_type, issuing_body, issue_date, expiry_date, owner_user_id, notes)
     values
      ($1,$2,$3,$4,$5,$6,$7,$8)
     returning *`,
    [
      orgId,
      p.name,
      p.frameworkType ?? null,
      p.issuingBody ?? null,
      p.issueDate ?? null,
      p.expiryDate ?? null,
      userId,
      p.notes ?? null
    ]
  );

  return r.rows[0];
});

// =======================
// Risks
// =======================
const CreateRisk = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().max(200).optional(),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  residualLikelihood: z.number().int().min(1).max(5).optional(),
  residualImpact: z.number().int().min(1).max(5).optional(),
  status: z.enum(["OPEN", "IN_TREATMENT", "ACCEPTED", "CLOSED"]).optional(),
  treatmentPlan: z.string().max(5000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

app.get("/risks", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `select * from risks
     where org_id = $1
     order by created_at desc
     limit 200`,
    [orgId]
  );
  return r.rows;
});

app.post("/risks", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");

  const p = CreateRisk.parse(cleanBody(req.body));

  const r = await pool.query(
    `insert into risks
      (org_id, title, description, category, likelihood, impact,
       residual_likelihood, residual_impact, status, owner_user_id,
       treatment_plan, due_date)
     values
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning *`,
    [
      orgId,
      p.title,
      p.description ?? null,
      p.category ?? null,
      p.likelihood,
      p.impact,
      p.residualLikelihood ?? null,
      p.residualImpact ?? null,
      p.status ?? "OPEN",
      userId,
      p.treatmentPlan ?? null,
      p.dueDate ?? null
    ]
  );

  return r.rows[0];
});

// =======================
// Audits
// =======================
const CreateAudit = z.object({
  type: z.enum(["INTERNAL", "EXTERNAL", "CERTIFICATION"]),
  title: z.string().min(2).max(200),
  scope: z.string().max(5000).optional(),
  auditor: z.string().max(200).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional()
});

app.get("/audits", async (req) => {
  const { orgId } = getAuth(req);
  const r = await pool.query(
    `select * from audits
     where org_id = $1
     order by created_at desc
     limit 200`,
    [orgId]
  );
  return r.rows;
});

app.post("/audits", async (req) => {
  const { orgId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");

  const p = CreateAudit.parse(cleanBody(req.body));

  const r = await pool.query(
    `insert into audits
      (org_id, type, title, scope, auditor, start_date, end_date, status)
     values
      ($1,$2,$3,$4,$5,$6,$7,$8)
     returning *`,
    [
      orgId,
      p.type,
      p.title,
      p.scope ?? null,
      p.auditor ?? null,
      p.startDate ?? null,
      p.endDate ?? null,
      p.status ?? "PLANNED"
    ]
  );

  return r.rows[0];
});

// =======================
// Findings
// =======================
const CreateFinding = z.object({
  auditId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  recommendation: z.string().max(5000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED"]).optional()
});

app.get("/audits/:id/findings", async (req) => {
  const { orgId } = getAuth(req);
  const auditId = (req.params as any).id as string;

  const r = await pool.query(
    `select * from audit_findings
     where org_id = $1 and audit_id = $2
     order by created_at desc`,
    [orgId, auditId]
  );

  return r.rows;
});

app.post("/findings", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");

  const p = CreateFinding.parse(cleanBody(req.body));

  const r = await pool.query(
    `insert into audit_findings
      (org_id, audit_id, title, description, severity, recommendation, owner_user_id, due_date, status)
     values
      ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning *`,
    [
      orgId,
      p.auditId,
      p.title,
      p.description ?? null,
      p.severity,
      p.recommendation ?? null,
      userId,
      p.dueDate ?? null,
      p.status ?? "OPEN"
    ]
  );

  return r.rows[0];
});

// =======================
// Auth Sync (Clerk → DB)
// =======================
app.post("/auth/sync", async (req) => {
  const clerkUserId = String(req.headers["x-clerk-user-id"] ?? "");
  const email = String(req.headers["x-clerk-email"] ?? "");
  const fullName = String(req.headers["x-clerk-name"] ?? "");

  if (!clerkUserId || !email) {
    throw new Error("Missing clerk user info");
  }

  const existing = await pool.query(
    `SELECT u.id as user_id, m.org_id, m.role
     FROM users u
     JOIN memberships m ON m.user_id = u.id
     WHERE u.cognito_sub = $1
     LIMIT 1`,
    [clerkUserId]
  );

  if (existing.rows.length > 0) {
    return {
      userId: existing.rows[0].user_id,
      orgId: existing.rows[0].org_id,
      role: existing.rows[0].role
    };
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

  return { userId, orgId, role: "ADMIN" };
});

// =======================
// Evidence Files
// =======================
app.post("/evidence/upload", async (req) => {
  const { orgId, userId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");

  const data = await req.file();
  if (!data) throw new Error("No file uploaded");

  const entityType = String((data.fields?.entityType as any)?.value ?? "");
  const entityId = String((data.fields?.entityId as any)?.value ?? "");

  if (!["CERTIFICATION", "RISK", "AUDIT", "FINDING"].includes(entityType)) {
    throw new Error("Invalid entity type");
  }
  if (!entityId) throw new Error("Missing entity ID");

  const buffer = await data.toBuffer();
  const fileName = data.filename;
  const mimeType = data.mimetype;
  const fileSize = buffer.length;

  const storageKey = `${orgId}/${entityType}/${entityId}/${Date.now()}-${fileName}`;
  const filePath = join(UPLOAD_DIR, storageKey);

  await mkdir(join(UPLOAD_DIR, orgId, entityType, entityId), { recursive: true });
  await writeFile(filePath, buffer);

  const r = await pool.query(
    `INSERT INTO evidence_files
      (org_id, entity_type, entity_id, file_name, mime_type, file_size, s3_key, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [orgId, entityType, entityId, fileName, mimeType, fileSize, storageKey, userId]
  );

  return r.rows[0];
});

app.get("/evidence/:entityType/:entityId", async (req) => {
  const { orgId } = getAuth(req);
  const { entityType, entityId } = req.params as { entityType: string; entityId: string };

  const r = await pool.query(
    `SELECT id, file_name, mime_type, file_size, uploaded_at
     FROM evidence_files
     WHERE org_id = $1 AND entity_type = $2 AND entity_id = $3
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
  const { orgId, role } = getAuth(req);
  if (role === "VIEWER") throw new Error("Forbidden");

  const { fileId } = req.params as { fileId: string };

  const r = await pool.query(
    `DELETE FROM evidence_files WHERE id = $1 AND org_id = $2 RETURNING *`,
    [fileId, orgId]
  );

  if (r.rows.length === 0) throw new Error("File not found");
  return { deleted: true };
});

// --- Error handler ---
app.setErrorHandler((err, _req, reply) => {
  const msg = err instanceof Error ? err.message : "Unknown error";
  reply.status(400).send({ error: msg });
});

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" })
  .then(() => console.log(`API running on http://localhost:${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
```

Also add `uploads/` to your `.gitignore` file (the `.gitignore` in your project root, not `server.ts`). Just add this line at the end:
```
uploads/
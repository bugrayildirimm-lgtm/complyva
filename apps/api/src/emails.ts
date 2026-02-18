import { Resend } from "resend";
import { pool } from "./db";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Complyva Alerts <onboarding@resend.dev>";

// --- Send a single email ---
async function sendEmail(to: string, subject: string, html: string) {
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error("Email failed:", err);
  }
}

// --- Get all users with their org emails ---
async function getOrgUsers(orgId: string) {
  const r = await pool.query(
    `SELECT u.email, u.full_name
     FROM users u
     JOIN memberships m ON m.user_id = u.id
     WHERE m.org_id = $1`,
    [orgId]
  );
  return r.rows as { email: string; full_name: string | null }[];
}

// --- Get all orgs ---
async function getAllOrgs() {
  const r = await pool.query(`SELECT id, name FROM organisations`);
  return r.rows as { id: string; name: string }[];
}

// =====================
// Alert Checks
// =====================

export async function checkExpiringCertifications() {
  console.log("Checking expiring certifications...");
  const r = await pool.query(`
    SELECT c.*, o.name as org_name
    FROM certifications c
    JOIN organisations o ON o.id = c.org_id
    WHERE c.expiry_date IS NOT NULL
      AND c.expiry_date <= (current_date + interval '60 days')
      AND c.expiry_date > current_date
      AND c.status = 'ACTIVE'
  `);

  for (const cert of r.rows) {
    const users = await getOrgUsers(cert.org_id);
    const daysLeft = Math.ceil(
      (new Date(cert.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    for (const user of users) {
      await sendEmail(
        user.email,
        `⚠️ Certification "${cert.name}" expires in ${daysLeft} days`,
        `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #111;">Certification Expiring Soon</h2>
          <p>Hi ${user.full_name || "there"},</p>
          <p>The certification <strong>${cert.name}</strong> is expiring in <strong>${daysLeft} days</strong> (${String(cert.expiry_date).slice(0, 10)}).</p>
          <table style="border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 12px; color: #6b7280;">Framework</td><td style="padding: 6px 12px; font-weight: 600;">${cert.framework_type || "-"}</td></tr>
            <tr><td style="padding: 6px 12px; color: #6b7280;">Issuing Body</td><td style="padding: 6px 12px; font-weight: 600;">${cert.issuing_body || "-"}</td></tr>
          </table>
          <p>Please take action to renew this certification.</p>
          <p style="color: #9ca3af; font-size: 12px;">— Complyva Alerts</p>
        </div>
        `
      );
    }
  }
  console.log(`Found ${r.rows.length} expiring certifications`);
}

export async function checkRiskDueDates() {
  console.log("Checking risk due dates...");
  const r = await pool.query(`
    SELECT r.*, o.name as org_name
    FROM risks r
    JOIN organisations o ON o.id = r.org_id
    WHERE r.due_date IS NOT NULL
      AND r.due_date <= (current_date + interval '7 days')
      AND r.due_date >= current_date
      AND r.status IN ('OPEN', 'IN_TREATMENT')
  `);

  for (const risk of r.rows) {
    const users = await getOrgUsers(risk.org_id);
    const daysLeft = Math.ceil(
      (new Date(risk.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    for (const user of users) {
      await sendEmail(
        user.email,
        `⏰ Risk "${risk.title}" due in ${daysLeft} days`,
        `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #111;">Risk Due Date Approaching</h2>
          <p>Hi ${user.full_name || "there"},</p>
          <p>The risk <strong>${risk.title}</strong> has a treatment due date in <strong>${daysLeft} days</strong> (${String(risk.due_date).slice(0, 10)}).</p>
          <table style="border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 12px; color: #6b7280;">Category</td><td style="padding: 6px 12px; font-weight: 600;">${risk.category || "-"}</td></tr>
            <tr><td style="padding: 6px 12px; color: #6b7280;">Risk Score</td><td style="padding: 6px 12px; font-weight: 600;">${risk.inherent_score}</td></tr>
            <tr><td style="padding: 6px 12px; color: #6b7280;">Status</td><td style="padding: 6px 12px; font-weight: 600;">${risk.status}</td></tr>
          </table>
          <p>Please review and update the treatment plan.</p>
          <p style="color: #9ca3af; font-size: 12px;">— Complyva Alerts</p>
        </div>
        `
      );
    }
  }
  console.log(`Found ${r.rows.length} risks with approaching due dates`);
}

export async function checkFindingDueDates() {
  console.log("Checking finding due dates...");
  const r = await pool.query(`
    SELECT f.*, o.name as org_name
    FROM audit_findings f
    JOIN organisations o ON o.id = f.org_id
    WHERE f.due_date IS NOT NULL
      AND f.due_date <= (current_date + interval '7 days')
      AND f.due_date >= current_date
      AND f.status IN ('OPEN', 'IN_PROGRESS')
  `);

  for (const finding of r.rows) {
    const users = await getOrgUsers(finding.org_id);
    const daysLeft = Math.ceil(
      (new Date(finding.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    for (const user of users) {
      await sendEmail(
        user.email,
        `🔍 Finding "${finding.title}" due in ${daysLeft} days`,
        `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #111;">Finding Due Date Approaching</h2>
          <p>Hi ${user.full_name || "there"},</p>
          <p>The audit finding <strong>${finding.title}</strong> is due in <strong>${daysLeft} days</strong> (${String(finding.due_date).slice(0, 10)}).</p>
          <table style="border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 12px; color: #6b7280;">Severity</td><td style="padding: 6px 12px; font-weight: 600;">${finding.severity}</td></tr>
            <tr><td style="padding: 6px 12px; color: #6b7280;">Status</td><td style="padding: 6px 12px; font-weight: 600;">${finding.status}</td></tr>
          </table>
          <p>Please resolve this finding before the due date.</p>
          <p style="color: #9ca3af; font-size: 12px;">— Complyva Alerts</p>
        </div>
        `
      );
    }
  }
  console.log(`Found ${r.rows.length} findings with approaching due dates`);
}

export async function checkAuditStartDates() {
  console.log("Checking upcoming audits...");
  const r = await pool.query(`
    SELECT a.*, o.name as org_name
    FROM audits a
    JOIN organisations o ON o.id = a.org_id
    WHERE a.start_date IS NOT NULL
      AND a.start_date <= (current_date + interval '7 days')
      AND a.start_date >= current_date
      AND a.status = 'PLANNED'
  `);

  for (const audit of r.rows) {
    const users = await getOrgUsers(audit.org_id);
    const daysLeft = Math.ceil(
      (new Date(audit.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    for (const user of users) {
      await sendEmail(
        user.email,
        `📋 Audit "${audit.title}" starts in ${daysLeft} days`,
        `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #111;">Audit Starting Soon</h2>
          <p>Hi ${user.full_name || "there"},</p>
          <p>The audit <strong>${audit.title}</strong> is starting in <strong>${daysLeft} days</strong> (${String(audit.start_date).slice(0, 10)}).</p>
          <table style="border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 12px; color: #6b7280;">Type</td><td style="padding: 6px 12px; font-weight: 600;">${audit.type}</td></tr>
            <tr><td style="padding: 6px 12px; color: #6b7280;">Auditor</td><td style="padding: 6px 12px; font-weight: 600;">${audit.auditor || "-"}</td></tr>
          </table>
          <p>Please ensure all preparations are complete.</p>
          <p style="color: #9ca3af; font-size: 12px;">— Complyva Alerts</p>
        </div>
        `
      );
    }
  }
  console.log(`Found ${r.rows.length} upcoming audits`);
}

export async function sendWeeklyDigest() {
  console.log("Sending weekly digest...");
  const orgs = await getAllOrgs();

  for (const org of orgs) {
    const users = await getOrgUsers(org.id);

    const certs = await pool.query(
      `SELECT count(*)::int as count FROM certifications
       WHERE org_id = $1 AND expiry_date IS NOT NULL
       AND expiry_date <= (current_date + interval '60 days') AND status = 'ACTIVE'`,
      [org.id]
    );

    const risks = await pool.query(
      `SELECT count(*)::int as count FROM risks
       WHERE org_id = $1 AND status IN ('OPEN', 'IN_TREATMENT')`,
      [org.id]
    );

    const findings = await pool.query(
      `SELECT count(*)::int as count FROM audit_findings
       WHERE org_id = $1 AND status IN ('OPEN', 'IN_PROGRESS')`,
      [org.id]
    );

    const audits = await pool.query(
      `SELECT count(*)::int as count FROM audits
       WHERE org_id = $1 AND status = 'IN_PROGRESS'`,
      [org.id]
    );

    const expiringCount = certs.rows[0]?.count ?? 0;
    const riskCount = risks.rows[0]?.count ?? 0;
    const findingCount = findings.rows[0]?.count ?? 0;
    const auditCount = audits.rows[0]?.count ?? 0;

    for (const user of users) {
      await sendEmail(
        user.email,
        `📊 Weekly Compliance Digest — ${org.name}`,
        `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #111;">Weekly Compliance Digest</h2>
          <p>Hi ${user.full_name || "there"},</p>
          <p>Here's your weekly compliance summary for <strong>${org.name}</strong>:</p>
          <table style="border-collapse: collapse; margin: 16px 0; width: 100%;">
            <tr style="border-bottom: 1px solid #e8eaed;">
              <td style="padding: 12px; font-weight: 600;">⚠️ Expiring Certifications (60d)</td>
              <td style="padding: 12px; font-size: 20px; font-weight: 700; text-align: right;">${expiringCount}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e8eaed;">
              <td style="padding: 12px; font-weight: 600;">🔴 Open Risks</td>
              <td style="padding: 12px; font-size: 20px; font-weight: 700; text-align: right;">${riskCount}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e8eaed;">
              <td style="padding: 12px; font-weight: 600;">🔍 Open Findings</td>
              <td style="padding: 12px; font-size: 20px; font-weight: 700; text-align: right;">${findingCount}</td>
            </tr>
            <tr>
              <td style="padding: 12px; font-weight: 600;">📋 Active Audits</td>
              <td style="padding: 12px; font-size: 20px; font-weight: 700; text-align: right;">${auditCount}</td>
            </tr>
          </table>
          <p>Log in to Complyva to take action on any open items.</p>
          <p style="color: #9ca3af; font-size: 12px;">— Complyva Alerts</p>
        </div>
        `
      );
    }
  }
  console.log("Weekly digest sent");
}

// =====================
// Run all checks
// =====================
export async function runAllAlerts() {
  await checkExpiringCertifications();
  await checkRiskDueDates();
  await checkFindingDueDates();
  await checkAuditStartDates();
}
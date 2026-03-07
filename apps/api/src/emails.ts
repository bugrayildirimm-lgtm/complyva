import { Resend } from "resend";
import { pool } from "./db";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Complyva <notifications@complyva.com>";

// --- Send a single email ---
export async function sendEmail(to: string, subject: string, html: string) {
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error("Email failed:", err);
  }
}

// --- Helpers ---
async function getOrgUsers(orgId: string) {
  const r = await pool.query(
    `SELECT u.email, u.full_name, m.role
     FROM users u JOIN memberships m ON m.user_id = u.id
     WHERE m.org_id = $1 AND u.email_verified = true AND u.password_hash IS NOT NULL`,
    [orgId]
  );
  return r.rows as { email: string; full_name: string | null; role: string }[];
}

async function getActiveOrgs() {
  const r = await pool.query(
    `SELECT id, name FROM organisations WHERE plan != 'suspended'`
  );
  return r.rows as { id: string; name: string }[];
}

function emailWrap(content: string) {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
    <div style="border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 24px;">
      <img src="https://complyva.com/logo.png" alt="Complyva" style="height: 22px;" />
    </div>
    ${content}
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">This is an automated notification from Complyva. <a href="https://complyva.com/sign-in" style="color: #0891b2;">Log in</a> to manage your compliance.</p>
    </div>
  </div>`;
}

function daysUntil(date: string | Date): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function daysSince(date: string | Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// =====================
// DAILY ALERTS
// =====================

export async function checkExpiringCertifications() {
  console.log("Checking expiring certifications...");
  const r = await pool.query(`
    SELECT c.*, o.name as org_name
    FROM certifications c JOIN organisations o ON o.id = c.org_id
    WHERE c.expiry_date IS NOT NULL
      AND c.expiry_date > current_date
      AND c.expiry_date <= (current_date + interval '60 days')
      AND c.status = 'ACTIVE'
      AND o.plan != 'suspended'
  `);

  for (const cert of r.rows) {
    const users = await getOrgUsers(cert.org_id);
    const days = daysUntil(cert.expiry_date);
    // Only alert at 60, 30, 14, 7, 3, 1 day marks
    if (![60, 30, 14, 7, 3, 1].includes(days)) continue;

    const urgency = days <= 3 ? "#dc2626" : days <= 7 ? "#f59e0b" : "#0891b2";
    for (const user of users) {
      await sendEmail(
        user.email,
        `Certification "${cert.name}" expires in ${days} day${days !== 1 ? "s" : ""}`,
        emailWrap(`
          <h2 style="color: #111; font-size: 18px; margin: 0 0 8px;">Certification Expiring</h2>
          <p style="color: #374151;">Hi ${user.full_name || "there"},</p>
          <div style="background: #f9fafb; border-left: 4px solid ${urgency}; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <div style="font-weight: 700; font-size: 16px; color: #111;">${cert.name}</div>
            <div style="color: #6b7280; font-size: 13px; margin-top: 4px;">Expires ${fmtDate(cert.expiry_date)} (${days} day${days !== 1 ? "s" : ""} remaining)</div>
            ${cert.framework_type ? `<div style="color: #6b7280; font-size: 13px; margin-top: 2px;">Framework: ${cert.framework_type}</div>` : ""}
            ${cert.issuing_body ? `<div style="color: #6b7280; font-size: 13px; margin-top: 2px;">Issuer: ${cert.issuing_body}</div>` : ""}
          </div>
          <p style="color: #374151;">Please take action to renew this certification before it expires.</p>
        `)
      );
    }
  }
  console.log(`Checked ${r.rows.length} expiring certifications`);
}

export async function checkOverdueItems() {
  console.log("Checking overdue items...");
  const orgs = await getActiveOrgs();

  for (const org of orgs) {
    const users = await getOrgUsers(org.id);
    if (users.length === 0) continue;

    // Overdue risks
    const risks = await pool.query(
      `SELECT title, due_date, status, inherent_score FROM risks
       WHERE org_id = $1 AND due_date < current_date AND status IN ('OPEN', 'IN_TREATMENT') ORDER BY due_date`,
      [org.id]
    );

    // Overdue findings
    const findings = await pool.query(
      `SELECT title, due_date, severity, status FROM audit_findings
       WHERE org_id = $1 AND due_date < current_date AND status IN ('OPEN', 'IN_PROGRESS') ORDER BY due_date`,
      [org.id]
    );

    // Overdue CAPAs
    const capas = await pool.query(
      `SELECT title, due_date, status FROM capas
       WHERE org_id = $1 AND due_date < current_date AND status IN ('OPEN', 'IN_PROGRESS') ORDER BY due_date`,
      [org.id]
    );

    // Expired certs still marked active
    const expiredCerts = await pool.query(
      `SELECT name, expiry_date FROM certifications
       WHERE org_id = $1 AND expiry_date < current_date AND status = 'ACTIVE' ORDER BY expiry_date`,
      [org.id]
    );

    const totalOverdue = risks.rows.length + findings.rows.length + capas.rows.length + expiredCerts.rows.length;
    if (totalOverdue === 0) continue;

    let items = "";

    if (expiredCerts.rows.length > 0) {
      items += `<div style="margin-bottom: 16px;">
        <div style="font-weight: 700; color: #dc2626; font-size: 13px; margin-bottom: 6px;">EXPIRED CERTIFICATIONS (${expiredCerts.rows.length})</div>
        ${expiredCerts.rows.map((c: any) => `<div style="font-size: 13px; color: #374151; padding: 4px 0;">${c.name} <span style="color: #9ca3af;">expired ${fmtDate(c.expiry_date)}</span></div>`).join("")}
      </div>`;
    }

    if (risks.rows.length > 0) {
      items += `<div style="margin-bottom: 16px;">
        <div style="font-weight: 700; color: #dc2626; font-size: 13px; margin-bottom: 6px;">OVERDUE RISKS (${risks.rows.length})</div>
        ${risks.rows.map((r: any) => `<div style="font-size: 13px; color: #374151; padding: 4px 0;">${r.title} <span style="color: #9ca3af;">due ${fmtDate(r.due_date)} (${daysSince(r.due_date)}d overdue)</span></div>`).join("")}
      </div>`;
    }

    if (findings.rows.length > 0) {
      items += `<div style="margin-bottom: 16px;">
        <div style="font-weight: 700; color: #dc2626; font-size: 13px; margin-bottom: 6px;">OVERDUE FINDINGS (${findings.rows.length})</div>
        ${findings.rows.map((f: any) => `<div style="font-size: 13px; color: #374151; padding: 4px 0;">${f.title} <span style="color: #9ca3af;">due ${fmtDate(f.due_date)} (${daysSince(f.due_date)}d overdue)</span></div>`).join("")}
      </div>`;
    }

    if (capas.rows.length > 0) {
      items += `<div style="margin-bottom: 16px;">
        <div style="font-weight: 700; color: #dc2626; font-size: 13px; margin-bottom: 6px;">OVERDUE CAPAs (${capas.rows.length})</div>
        ${capas.rows.map((c: any) => `<div style="font-size: 13px; color: #374151; padding: 4px 0;">${c.title} <span style="color: #9ca3af;">due ${fmtDate(c.due_date)} (${daysSince(c.due_date)}d overdue)</span></div>`).join("")}
      </div>`;
    }

    // Only send to admins and auditors
    for (const user of users.filter(u => u.role !== "VIEWER")) {
      await sendEmail(
        user.email,
        `${totalOverdue} overdue item${totalOverdue !== 1 ? "s" : ""} require attention`,
        emailWrap(`
          <h2 style="color: #dc2626; font-size: 18px; margin: 0 0 8px;">Overdue Items</h2>
          <p style="color: #374151;">Hi ${user.full_name || "there"},</p>
          <p style="color: #374151;">Your organisation <strong>${org.name}</strong> has <strong>${totalOverdue} overdue item${totalOverdue !== 1 ? "s" : ""}</strong> that need attention:</p>
          <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0;">
            ${items}
          </div>
          <p style="color: #374151;"><a href="https://complyva.com/dashboard" style="color: #0891b2; font-weight: 600;">Log in to resolve these items</a></p>
        `)
      );
    }
  }
  console.log("Overdue check complete");
}

export async function checkUpcomingDueDates() {
  console.log("Checking upcoming due dates...");
  const orgs = await getActiveOrgs();

  for (const org of orgs) {
    const users = await getOrgUsers(org.id);
    if (users.length === 0) continue;

    // Risks due within 7 days
    const risks = await pool.query(
      `SELECT title, due_date, status FROM risks
       WHERE org_id = $1 AND due_date >= current_date AND due_date <= (current_date + interval '7 days') AND status IN ('OPEN', 'IN_TREATMENT')`,
      [org.id]
    );

    // Findings due within 7 days
    const findings = await pool.query(
      `SELECT title, due_date, severity FROM audit_findings
       WHERE org_id = $1 AND due_date >= current_date AND due_date <= (current_date + interval '7 days') AND status IN ('OPEN', 'IN_PROGRESS')`,
      [org.id]
    );

    // Audits starting within 7 days
    const audits = await pool.query(
      `SELECT title, start_date, type FROM audits
       WHERE org_id = $1 AND start_date >= current_date AND start_date <= (current_date + interval '7 days') AND status = 'PLANNED'`,
      [org.id]
    );

    // CAPAs due within 7 days
    const capas = await pool.query(
      `SELECT title, due_date FROM capas
       WHERE org_id = $1 AND due_date >= current_date AND due_date <= (current_date + interval '7 days') AND status IN ('OPEN', 'IN_PROGRESS')`,
      [org.id]
    );

    const total = risks.rows.length + findings.rows.length + audits.rows.length + capas.rows.length;
    if (total === 0) continue;

    let items = "";
    const addSection = (title: string, rows: any[], dateField: string) => {
      if (rows.length === 0) return;
      items += `<div style="margin-bottom: 12px;">
        <div style="font-weight: 700; color: #f59e0b; font-size: 13px; margin-bottom: 4px;">${title} (${rows.length})</div>
        ${rows.map((r: any) => `<div style="font-size: 13px; color: #374151; padding: 3px 0;">${r.title} <span style="color: #9ca3af;">${fmtDate(r[dateField])}</span></div>`).join("")}
      </div>`;
    };

    addSection("RISKS DUE", risks.rows, "due_date");
    addSection("FINDINGS DUE", findings.rows, "due_date");
    addSection("AUDITS STARTING", audits.rows, "start_date");
    addSection("CAPAs DUE", capas.rows, "due_date");

    for (const user of users.filter(u => u.role !== "VIEWER")) {
      await sendEmail(
        user.email,
        `${total} item${total !== 1 ? "s" : ""} due this week`,
        emailWrap(`
          <h2 style="color: #111; font-size: 18px; margin: 0 0 8px;">Upcoming This Week</h2>
          <p style="color: #374151;">Hi ${user.full_name || "there"},</p>
          <p style="color: #374151;"><strong>${org.name}</strong> has <strong>${total} item${total !== 1 ? "s" : ""}</strong> due in the next 7 days:</p>
          <div style="background: #fffbeb; border-radius: 8px; padding: 16px; margin: 16px 0;">
            ${items}
          </div>
          <p style="color: #374151;"><a href="https://complyva.com/dashboard" style="color: #0891b2; font-weight: 600;">Log in to take action</a></p>
        `)
      );
    }
  }
  console.log("Upcoming due dates check complete");
}

// =====================
// WEEKLY DIGEST (Mondays)
// =====================

export async function sendWeeklyDigest() {
  console.log("Sending weekly digest...");
  const orgs = await getActiveOrgs();

  for (const org of orgs) {
    const users = await getOrgUsers(org.id);
    if (users.length === 0) continue;

    const [certs, risks, findings, audits, incidents, ncs] = await Promise.all([
      pool.query(`SELECT count(*)::int as total, count(*) FILTER (WHERE expiry_date <= current_date + interval '60 days' AND expiry_date > current_date AND status = 'ACTIVE')::int as expiring FROM certifications WHERE org_id = $1`, [org.id]),
      pool.query(`SELECT count(*)::int as open, count(*) FILTER (WHERE due_date < current_date)::int as overdue FROM risks WHERE org_id = $1 AND status IN ('OPEN', 'IN_TREATMENT')`, [org.id]),
      pool.query(`SELECT count(*)::int as open, count(*) FILTER (WHERE due_date < current_date)::int as overdue FROM audit_findings WHERE org_id = $1 AND status IN ('OPEN', 'IN_PROGRESS')`, [org.id]),
      pool.query(`SELECT count(*)::int as active FROM audits WHERE org_id = $1 AND status = 'IN_PROGRESS'`, [org.id]),
      pool.query(`SELECT count(*)::int as open FROM incidents WHERE org_id = $1 AND status IN ('OPEN', 'INVESTIGATING')`, [org.id]),
      pool.query(`SELECT count(*)::int as open FROM nonconformities WHERE org_id = $1 AND status IN ('OPEN', 'IN_PROGRESS')`, [org.id]),
    ]);

    const data = {
      certsExpiring: certs.rows[0]?.expiring ?? 0,
      risksOpen: risks.rows[0]?.open ?? 0,
      risksOverdue: risks.rows[0]?.overdue ?? 0,
      findingsOpen: findings.rows[0]?.open ?? 0,
      findingsOverdue: findings.rows[0]?.overdue ?? 0,
      auditsActive: audits.rows[0]?.active ?? 0,
      incidentsOpen: incidents.rows[0]?.open ?? 0,
      ncsOpen: ncs.rows[0]?.open ?? 0,
    };

    const hasIssues = Object.values(data).some(v => v > 0);

    const row = (label: string, value: number, warn: boolean = false) =>
      `<tr><td style="padding: 10px 14px; font-size: 14px; color: #374151; border-bottom: 1px solid #f3f4f6;">${label}</td>
       <td style="padding: 10px 14px; font-size: 18px; font-weight: 700; text-align: right; border-bottom: 1px solid #f3f4f6; color: ${warn && value > 0 ? "#dc2626" : "#111"};">${value}</td></tr>`;

    for (const user of users) {
      await sendEmail(
        user.email,
        `Weekly Compliance Summary for ${org.name}`,
        emailWrap(`
          <h2 style="color: #111; font-size: 18px; margin: 0 0 8px;">Weekly Compliance Summary</h2>
          <p style="color: #374151;">Hi ${user.full_name || "there"},</p>
          <p style="color: #374151;">Here is your weekly overview for <strong>${org.name}</strong>:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #f9fafb; border-radius: 8px; overflow: hidden;">
            ${row("Certifications expiring (60d)", data.certsExpiring, true)}
            ${row("Open risks", data.risksOpen)}
            ${row("Overdue risks", data.risksOverdue, true)}
            ${row("Open findings", data.findingsOpen)}
            ${row("Overdue findings", data.findingsOverdue, true)}
            ${row("Active audits", data.auditsActive)}
            ${row("Open incidents", data.incidentsOpen)}
            ${row("Open non-conformities", data.ncsOpen)}
          </table>
          ${hasIssues
            ? `<p style="color: #374151;"><a href="https://complyva.com/dashboard" style="color: #0891b2; font-weight: 600;">Log in to review and take action</a></p>`
            : `<p style="color: #16a34a; font-weight: 600;">All clear! No outstanding compliance items.</p>`
          }
        `)
      );
    }
  }
  console.log("Weekly digest complete");
}

// =====================
// Run all daily checks
// =====================
export async function runDailyAlerts() {
  console.log("=== Running daily alerts ===");
  await checkExpiringCertifications();
  await checkOverdueItems();
  await checkUpcomingDueDates();
  console.log("=== Daily alerts complete ===");
}

// Keep backward compat
export async function runAllAlerts() {
  await runDailyAlerts();
}

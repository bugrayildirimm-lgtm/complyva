import { pool } from "./db";

export async function logActivity(
  orgId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  entityName: string | null,
  details?: string
) {
  try {
    await pool.query(
      `INSERT INTO activity_log (org_id, actor_user_id, action, entity_type, entity_id, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orgId, userId, action, entityType, entityId, JSON.stringify({ name: entityName, details: details ?? null })]
    );
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}
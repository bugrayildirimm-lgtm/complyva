import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://app:app@localhost:5433/compliance",
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

export { pool };
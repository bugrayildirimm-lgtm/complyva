import pg from "pg";

const connString = process.env.DATABASE_URL || "postgresql://app:app@localhost:5433/compliance";
const isLocal = connString.includes("localhost") || connString.includes("127.0.0.1");

const pool = new pg.Pool({
  connectionString: connString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export { pool };
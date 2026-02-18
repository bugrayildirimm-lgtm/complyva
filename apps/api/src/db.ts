import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST ?? "127.0.0.1",
  port: Number(process.env.PGPORT ?? 5433),
  database: process.env.PGDATABASE ?? "compliance",
  user: process.env.PGUSER ?? "app",
  password: process.env.PGPASSWORD ?? "app",
  max: 5
});

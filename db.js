import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing");
  throw new Error("DATABASE_URL env var is required");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
pool.on("connect", (client) => {
  client.query("SET client_encoding TO 'UTF8'").catch(() => {});
});

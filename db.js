import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL_INTERNAL) {
  console.error('❌ DATABASE_URL_INTERNAL is missing');
  throw new Error('DATABASE_URL_INTERNAL env var is required');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

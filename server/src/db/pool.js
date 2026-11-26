import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;

function build() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return { connectionString: undefined };
  let ssl;
  let connectionString = raw;
  try {
    const url = new URL(raw);
    const mode = url.searchParams.get('sslmode');
    const local = ['localhost', '127.0.0.1', 'db'].includes(url.hostname);
    const wantSsl = process.env.DATABASE_SSL === 'true' || (process.env.DATABASE_SSL !== 'false' && ((mode && mode !== 'disable') || !local));
    // Aiven uses its own CA; "sslmode=require" would be treated as verify-full by newer pg, so strip it and set ssl explicitly.
    url.searchParams.delete('sslmode');
    connectionString = url.toString();
    if (wantSsl) ssl = { rejectUnauthorized: false };
  } catch { /* keep raw string */ }
  return { connectionString, ssl };
}

const onVercel = Boolean(process.env.VERCEL);
export const pool = new Pool({
  ...build(),
  max: onVercel ? 3 : 10,
  idleTimeoutMillis: onVercel ? 10_000 : 30_000,
  connectionTimeoutMillis: 10_000
});
pool.on('error', error => console.error('Unexpected PostgreSQL pool error:', error.message));

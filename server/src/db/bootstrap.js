import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import schema from './schema.js';

const LOCK_ID = 727274;

export async function initSchema() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    try { await client.query(schema); }
    finally { await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {}); }
  } finally { client.release(); }
}

export async function bootstrapAdmin() {
  const username = (process.env.ADMIN_USERNAME || 'Admen').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const email = process.env.ADMIN_EMAIL || null;
  if (password.length < 12 || /CHANGE/i.test(password)) {
    const { rows } = await pool.query('SELECT 1 FROM users LIMIT 1');
    if (!rows.length) console.warn('No admin exists yet: set ADMIN_PASSWORD (12+ characters) in the environment variables.');
    return;
  }
  const exists = await pool.query('SELECT 1 FROM users WHERE username=$1', [username]);
  if (exists.rows.length) return;
  const hash = await bcrypt.hash(password, 12);
  await pool.query('INSERT INTO users(username,email,password_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [username, email, hash]);
}

let ready = null;
export function ensureReady() {
  if (!ready) {
    ready = (async () => {
      let last;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try { await initSchema(); await bootstrapAdmin(); return; }
        catch (error) { last = error; console.error(`DB init attempt ${attempt}/3 failed: ${error.message}`); await new Promise(r => setTimeout(r, 1500)); }
      }
      throw last;
    })().catch(error => { ready = null; throw error; });
  }
  return ready;
}

import { pool } from './pool.js';
import { ensureReady } from './bootstrap.js';
try { await ensureReady(); console.log('Database schema initialized.'); }
catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await pool.end(); }

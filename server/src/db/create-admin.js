import 'dotenv/config';
import { pool } from './pool.js';
import { bootstrapAdmin } from './bootstrap.js';
try { await bootstrapAdmin(); console.log('Admin bootstrap checked. Existing accounts are not overwritten.'); }
catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await pool.end(); }

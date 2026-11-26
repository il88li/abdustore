import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import multer from 'multer';
import { pool } from './db/pool.js';
import authRoutes from './routes/auth.js';
import storeRoutes from './routes/store.js';
import adminRoutes from './routes/admin.js';
import { requireAdmin } from './middleware/auth.js';
import { ensureReady } from './db/bootstrap.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
    connectSrc: ["'self'", 'https:'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    frameAncestors: ["'self'"]
  }}
}));

const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map(value => value.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: false
}));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await ensureReady();
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected', service: 'Hipe Store API' });
  } catch (error) {
    console.error(error.message);
    res.status(503).json({ ok: false, database: 'unavailable', reason: error.code || error.name, service: 'Hipe Store API' });
  }
});

// Create the tables automatically (once per cold start) before any data route runs.
app.use(['/api', '/uploads'], async (_req, res, next) => {
  try { await ensureReady(); next(); }
  catch (error) { console.error(error.message); res.status(503).json({ error: 'قاعدة البيانات غير متاحة حالياً' }); }
});

app.get('/uploads/:name', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT mime,data FROM uploads WHERE name=$1', [req.params.name]);
    if (!rows[0]) return res.status(404).end();
    res.set('Content-Type', rows[0].mime);
    res.set('Cache-Control', 'public, max-age=604800, immutable');
    res.send(rows[0].data);
  } catch (error) { console.error(error.message); res.status(500).end(); }
});

app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false }), authRoutes);
app.use('/api/store', rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false }), storeRoutes);

const storage = multer.memoryStorage();
const imageUpload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const extension = path.extname(file.originalname).toLowerCase();
    const validExtension = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension);
    if (allowed.has(file.mimetype) && validExtension) return callback(null, true);
    return callback(new Error('يسمح فقط بصور JPG أو PNG أو WEBP'));
  }
});
app.post('/api/admin/upload', requireAdmin, rateLimit({ windowMs: 60 * 60_000, max: 60 }), imageUpload.single('image'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'اختر صورة JPG أو PNG أو WEBP لا تتجاوز 4 ميجابايت' });
  try {
    const name = `${Date.now()}-${randomBytes(16).toString('hex')}${path.extname(req.file.originalname).toLowerCase()}`;
    await pool.query('INSERT INTO uploads(name,mime,data) VALUES($1,$2,$3)', [name, req.file.mimetype, req.file.buffer]);
    res.status(201).json({ url: `/uploads/${name}` });
  } catch (error) { next(error); }
});
app.use('/api/admin', requireAdmin, adminRoutes);



app.use((error, _req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'حجم الصورة يتجاوز 4 ميجابايت' : 'تعذر رفع الملف' });
  }
  if (error.message?.includes('يسمح فقط بصور')) return res.status(400).json({ error: error.message });
  res.status(500).json({ error: 'حدث خطأ غير متوقع' });
});

export default app;

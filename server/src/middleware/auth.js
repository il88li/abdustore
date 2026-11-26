import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config.js';
export function requireAdmin(req,res,next) {
 const token = req.headers.authorization?.replace(/^Bearer\s+/i,'');
 if (!token) return res.status(401).json({error:'يجب تسجيل الدخول أولاً'});
 try { const payload=jwt.verify(token,getJwtSecret()); if(payload.role!=='admin') throw new Error('role'); req.admin=payload; next(); }
 catch { return res.status(401).json({error:'جلسة الدخول غير صالحة'}); }
}

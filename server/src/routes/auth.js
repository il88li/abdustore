import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { getJwtSecret } from '../config.js';
const router=Router();
router.post('/login', async(req,res)=>{
 const identifier=String(req.body.username||req.body.email||'').trim().slice(0,254); const password=String(req.body.password||'');
 if(!identifier||!password)return res.status(400).json({error:'أدخل اسم المستخدم أو البريد الإلكتروني وكلمة المرور'});
 const username=identifier.slice(0,80);
 try {
  const state=await pool.query('SELECT failed_count,blocked_until FROM login_attempts WHERE username=$1',[username]);
  if(state.rows[0]?.blocked_until && new Date(state.rows[0].blocked_until)>new Date()) return res.status(429).json({error:'تم إيقاف محاولات الدخول مؤقتاً. حاول بعد دقيقة.'});
  const {rows}=await pool.query('SELECT id,username,email,password_hash,role FROM users WHERE username=$1 OR LOWER(email)=LOWER($1) LIMIT 1',[identifier]);
  const ok=!!rows[0] && await bcrypt.compare(password,rows[0].password_hash);
  if(!ok){
   const expired=state.rows[0]?.blocked_until && new Date(state.rows[0].blocked_until)<=new Date(); const count=(expired?0:(state.rows[0]?.failed_count||0))+1; const blocked=count>=3;
   await pool.query(`INSERT INTO login_attempts(username,failed_count,blocked_until,updated_at) VALUES($1,$2,CASE WHEN $3 THEN NOW()+INTERVAL '1 minute' ELSE NULL END,NOW()) ON CONFLICT(username) DO UPDATE SET failed_count=EXCLUDED.failed_count,blocked_until=EXCLUDED.blocked_until,updated_at=NOW()`,[username,count,blocked]);
   return res.status(401).json({error:blocked?'ثلاث محاولات فاشلة. تم إيقاف الدخول لمدة دقيقة.':'اسم المستخدم أو كلمة المرور غير صحيحة'});
  }
  await pool.query('DELETE FROM login_attempts WHERE username=$1',[username]);
  const secret=getJwtSecret();
  const token=jwt.sign({id:rows[0].id,username:rows[0].username,role:rows[0].role},secret,{expiresIn:'8h'});
  res.json({token,username:rows[0].username,email:rows[0].email||null});
 } catch(e){ console.error(e); res.status(500).json({error:'حدث خطأ في الخادم'}); }
});
export default router;

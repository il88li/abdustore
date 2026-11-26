# هاي بي ستور | Hi B Store

متجر عربي RTL: واجهة React + Vite، وواجهة برمجية Express تعمل كدالة Vercel (`api/index.js`)، وقاعدة PostgreSQL.

## هيكل المشروع
- `index.html` و`src/` و`vite.config.js`: الواجهة (تُبنى إلى `dist`).
- `api/index.js`: نقطة دخول Vercel، وتستدعي التطبيق من `server/src/app.js`.
- `server/src/`: المسارات وقاعدة البيانات (`db/schema.js` ينشئ الجداول تلقائياً).
- `vercel.json`: إعادة توجيه `/api` و`/uploads` للدالة وباقي المسارات للواجهة.

## النشر على Vercel
1. ارفع الملفات إلى جذر مستودع GitHub جديد، ثم New Project واستورده (يُكتشف Vite تلقائياً).
2. أضف في Environment Variables: `DATABASE_URL` (مع `?sslmode=require`) و`ADMIN_PASSWORD` (12 حرفاً فأكثر)، واختيارياً `ADMIN_USERNAME` و`JWT_SECRET`.
3. اضغط Deploy ثم افتح `/api/health`: أول طلب ينشئ كل الجداول وحساب المسؤول.

## ملاحظات
- الصور تُحفظ في جدول `uploads` داخل PostgreSQL (الحد 4MB بسبب حد طلب Vercel).
- اتصالات قاعدة البيانات محدودة بـ 3 لكل نسخة.
- تشغيل محلي: `npm install` ثم `npm run dev:api` و`npm run dev` مع ملف `.env` فيه `DATABASE_URL`.

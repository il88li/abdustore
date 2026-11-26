import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db/pool.js';
const router=Router();
router.get('/categories',async(req,res)=>{try{const {rows}=await pool.query('SELECT * FROM categories ORDER BY sort_order,name');res.json(rows)}catch{res.status(500).json({error:'تعذر تحميل الأقسام'})}});
router.get('/products',async(req,res)=>{try{
 const {q='',category,featured}=req.query; const vals=[]; let where=['p.active=true'];
 if(q){vals.push(`%${q}%`);where.push(`(p.name ILIKE $${vals.length} OR p.description ILIKE $${vals.length})`)}
 if(category){vals.push(category);where.push(`p.category_id=$${vals.length}`)}
 if(featured==='true')where.push('p.featured=true');
 const {rows}=await pool.query(`SELECT p.*,(SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi JOIN orders sold_orders ON sold_orders.id=oi.order_id WHERE oi.product_id=p.id AND sold_orders.inventory_deducted=true) AS sold_count,c.name AS category_name,COALESCE(json_agg(DISTINCT pi.image_url) FILTER(WHERE pi.id IS NOT NULL),'[]') AS images,COALESCE((SELECT json_agg(json_build_object('id',v.id,'size',v.size,'color',v.color,'stock',v.stock)) FROM product_variants v WHERE v.product_id=p.id AND v.active=true),'[]') AS variants FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN product_images pi ON pi.product_id=p.id WHERE ${where.join(' AND ')} GROUP BY p.id,c.name ORDER BY p.created_at DESC`,vals);
 res.json(rows);
 }catch(e){console.error(e);res.status(500).json({error:'تعذر تحميل المنتجات'})}});
router.get('/products/:id',async(req,res)=>{try{const {rows}=await pool.query(`SELECT p.*,(SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi JOIN orders sold_orders ON sold_orders.id=oi.order_id WHERE oi.product_id=p.id AND sold_orders.inventory_deducted=true) AS sold_count,c.name AS category_name,COALESCE(json_agg(DISTINCT pi.image_url) FILTER(WHERE pi.id IS NOT NULL),'[]') AS images,COALESCE((SELECT json_agg(json_build_object('id',v.id,'size',v.size,'color',v.color,'stock',v.stock)) FROM product_variants v WHERE v.product_id=p.id AND v.active=true),'[]') AS variants FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN product_images pi ON pi.product_id=p.id WHERE p.id=$1 AND p.active=true GROUP BY p.id,c.name`,[req.params.id]);if(!rows[0])return res.status(404).json({error:'المنتج غير موجود'});res.json(rows[0])}catch{res.status(500).json({error:'تعذر تحميل المنتج'})}});
router.get('/settings',async(req,res)=>{try{const {rows}=await pool.query('SELECT key,value FROM settings');res.json(Object.fromEntries(rows.map(x=>[x.key,x.value])))}catch{res.status(500).json({error:'تعذر تحميل الإعدادات'})}});
router.post('/orders',async(req,res)=>{
 const {customer,items}=req.body||{};
 if(!customer?.name?.trim()||!customer?.phone?.trim()||!Array.isArray(items)||!items.length)return res.status(400).json({error:'أكمل بيانات العميل وأضف منتجاً واحداً على الأقل'});
 if(String(customer.name).length>160||String(customer.phone).length>40||String(customer.address||'').length>1000)return res.status(400).json({error:'بعض بيانات العميل طويلة أكثر من اللازم'});
 if(items.length>30)return res.status(400).json({error:'الحد الأقصى 30 صنفاً مختلفاً في الطلب'});
 const client=await pool.connect();
 try{
  await client.query('BEGIN'); let subtotal=0; const validated=[]; const reserved=new Map();
  for(const item of items){const {rows}=await client.query('SELECT id,name,description,price,old_price,stock FROM products WHERE id=$1 AND active=true FOR UPDATE',[item.productId]);const p=rows[0];const qty=Number(item.quantity);if(!p||!Number.isInteger(qty)||qty<1||qty>100)throw new Error('أحد المنتجات غير صالح');
   let unit=Number(p.price); let variantId=null; let size=null; let color=null;
   if(item.variantId){const v=await client.query('SELECT id,size,color,stock FROM product_variants WHERE id=$1 AND product_id=$2 AND active=true FOR UPDATE',[item.variantId,p.id]);if(!v.rows[0])throw new Error(`خيار المنتج ${p.name} غير صالح`);const key=`variant:${v.rows[0].id}`;const already=reserved.get(key)||0;if(already+qty>v.rows[0].stock)throw new Error(`الكمية غير متوفرة للمنتج ${p.name}`);reserved.set(key,already+qty);variantId=item.variantId;size=v.rows[0].size;color=v.rows[0].color;}
   else {const hasVariants=await client.query('SELECT 1 FROM product_variants WHERE product_id=$1 AND active=true LIMIT 1',[p.id]);if(hasVariants.rowCount)throw new Error(`يرجى اختيار المقاس أو اللون للمنتج ${p.name}`);const key=`product:${p.id}`;const already=reserved.get(key)||0;if(already+qty>p.stock)throw new Error(`الكمية غير متوفرة للمنتج ${p.name}`);reserved.set(key,already+qty);}
   const line=unit*qty;subtotal+=line;validated.push({p,qty,unit,line,size,color,variantId});
  }
  const feeResult=await client.query("SELECT value FROM settings WHERE key='delivery_fee'");const fee=Number(feeResult.rows[0]?.value||0);if(!Number.isFinite(fee)||fee<0)throw new Error('إعداد رسوم التوصيل غير صالح');const total=subtotal+fee;
  const c=await client.query('INSERT INTO customers(name,phone,governorate,city,address) VALUES($1,$2,$3,$4,$5) RETURNING id',[customer.name,customer.phone,customer.governorate||null,customer.city||null,customer.address||null]);
  const code=`HBS-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const o=await client.query('INSERT INTO orders(order_code,customer_id,subtotal,delivery_fee,total) VALUES($1,$2,$3,$4,$5) RETURNING id,order_code',[code,c.rows[0].id,subtotal,fee,total]);
  for(const x of validated){await client.query('INSERT INTO order_items(order_id,product_id,product_name,product_description,unit_price,quantity,size,color,variant_id,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[o.rows[0].id,x.p.id,x.p.name,x.p.description||'',x.unit,x.qty,x.size,x.color,x.variantId,x.line]);}
  await client.query('COMMIT');res.status(201).json({id:o.rows[0].id,orderCode:code,subtotal,deliveryFee:fee,total,items:validated.map(x=>({productId:x.p.id,name:x.p.name,description:x.p.description||'',unitPrice:x.unit,quantity:x.qty,size:x.size,color:x.color,lineTotal:x.line}))});
 }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'تعذر إنشاء الطلب'})}finally{client.release()}
});
export default router;

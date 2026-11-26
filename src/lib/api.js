const BASE=import.meta.env.VITE_API_URL||'/api';
export async function api(path,options={}){const token=localStorage.getItem('hipe_token');const headers={...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{}) ,...options.headers};const r=await fetch(`${BASE}${path}`,{...options,headers});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'حدث خطأ');return data}
export {BASE};

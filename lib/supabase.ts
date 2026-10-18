import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export function configured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }
export async function database() {
  if (!configured()) throw new Error('데이터베이스 연결이 필요합니다.');
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies:{
    getAll:()=>store.getAll(),
    setAll:values=>{ try { values.forEach(({name,value,options})=>store.set(name,value,options)); } catch { /* Server component: cookies can only be changed in an action or route. */ } },
  }});
}

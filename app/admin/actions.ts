'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { database } from '@/lib/supabase';
import {rosterReturnPath} from '@/lib/admin-application-filters';
export async function login(form:FormData) {
 let ok=false;
 try {const db=await database();const {error}=await db.auth.signInWithPassword({email:String(form.get('email')||''),password:String(form.get('password')||'')});if(!error){const {data}=await db.rpc('is_admin');ok=data===true;if(!ok)await db.auth.signOut();}}catch{}
 redirect(ok?'/admin':'/admin?error=login');
}
export async function logout(){const db=await database();await db.auth.signOut();redirect('/admin');}
export async function mutate(form:FormData) {
 const kind=String(form.get('kind'));const allowed=['save_settings','manage_session','manage_application','archive_session'];if(!allowed.includes(kind))redirect('/admin?error=operation');
 let error=false;
 try {const db=await database();const {data:{user}}=await db.auth.getUser();const {data:admin}=await db.rpc('is_admin');if(!user||!admin)redirect('/admin');
 const payload=Object.fromEntries(form.entries());
 const {error:failure}=await db.rpc(kind,{payload:{...payload,confirmed:form.has('confirmed'),accepting:form.has('accepting'),published:form.has('published')}});error=!!failure;
 }catch{error=true;}
 revalidatePath('/');revalidatePath('/admin');const destination=new URL(rosterReturnPath(form.get('returnTo')),'https://admin.invalid');destination.searchParams.set(error?'error':'success',error?'save':'1');redirect(destination.pathname+destination.search+destination.hash);
}

export async function importApplications(input:unknown):Promise<{error?:string;inserted?:number;skipped?:number}>{
 const {z}=await import('zod'); const {legacyRowSchema}=await import('@/lib/legacy-import');
 const parsed=z.object({sessionId:z.string().uuid(),rows:z.array(legacyRowSchema).min(1).max(500)}).safeParse(input);
 if(!parsed.success)return {error:'가져올 데이터 형식을 확인해주세요.'};
 try{const db=await database();const {data:{user}}=await db.auth.getUser();const {data:admin}=await db.rpc('is_admin');
 if(!user||!admin)return {error:'관리자 로그인이 필요합니다.'};
 const {data,error}=await db.rpc('import_legacy_applications',{payload:parsed.data});
 if(error)return {error:'가져오지 못했습니다. 회차·정원·원본 동의 내역과 추가 SQL 설치 여부를 확인해주세요. 이번 요청의 신규 등록은 반영되지 않았습니다.'};
 revalidatePath('/');revalidatePath('/admin');return {inserted:data.inserted,skipped:data.skipped};
 }catch{return {error:'처리 결과를 확인하지 못했습니다. 연결을 확인한 뒤 같은 파일을 다시 가져오면 기존 신청은 중복 등록하지 않습니다.'};}
}

export async function registerConfirmedHistory():Promise<{error?:string;added:number;completed:number}>{
 let added=0;let completed=0;
 try{
  const {confirmedHistory}=await import('@/lib/confirmed-history');
  const db=await database();const {data:{user}}=await db.auth.getUser();
  if(!user)return {error:'관리자 로그인이 필요합니다.',added,completed};
  const {data:admin}=await db.rpc('is_admin');
  if(admin!==true)return {error:'관리자 권한을 확인해주세요.',added,completed};
  const {data,error}=await db.rpc('session_list');
  if(error||!Array.isArray(data))return {error:'회차 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',added,completed};
  const sessions=data as import('@/lib/domain').Session[];
  if(!sessions.length||sessions.some(s=>typeof s.completed!=='boolean'))return {error:'지난 회차 관리용 DB 설정이 필요합니다. 아래의 ‘1~5회차 등록 SQL’ 파일 전체를 Supabase SQL Editor에서 실행한 뒤 새로고침해주세요.',added,completed};
  if(sessions.some(s=>s.cancelled&&confirmedHistory.some(h=>h.date===s.date)))return {error:'1~5회차 중 취소로 기록된 날짜가 있습니다. 실제 진행 여부와 회차 설정을 확인해주세요. 이번 요청은 변경하지 않았습니다.',added,completed};
  for(const round of confirmedHistory){
   const existing=sessions.find(s=>s.date===round.date);
   if(existing?.completed)continue;
   const payload=existing?{id:existing.id,operation:'complete',confirmed:true}:{...round,capacity:30,confirmed:true};
   const {error:failure}=await db.rpc(existing?'manage_session':'archive_session',{payload});
   if(failure)return {error:`등록 중 연결 또는 회차 상태를 확인하지 못했습니다. ${added}회차 신규 등록, ${completed}회차 완료 처리까지 확인했습니다. 새로고침 후 다시 누르면 이미 완료된 회차는 건너뜁니다.`,added,completed};
   if(existing)completed++;else added++;
  }
  return {added,completed};
 }catch{return {error:`등록 결과를 확인하지 못했습니다. 새로고침한 뒤 다시 시도해주세요. 확인된 신규 ${added}회차·완료 처리 ${completed}회차입니다.`,added,completed};}
 finally{revalidatePath('/');revalidatePath('/admin');}
}

export async function bulkApplications(input:unknown):Promise<import('@/lib/bulk-application-operation').BulkResult>{
 try{const {performBulkApplications}=await import('@/lib/bulk-application-operation');return await performBulkApplications(await database(),input);}
 catch{return {processed:[],skipped:[],failed:[],error:'연결 상태를 확인하지 못했습니다. 새로고침 후 현재 상태를 확인해주세요.'};}
 finally{revalidatePath('/admin');revalidatePath('/');}
}

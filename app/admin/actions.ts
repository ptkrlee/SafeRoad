'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { database } from '@/lib/supabase';
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
 revalidatePath('/');revalidatePath('/admin');redirect(error?'/admin?error=save':'/admin?success=1');
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

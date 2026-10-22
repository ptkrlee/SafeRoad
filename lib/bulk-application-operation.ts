import type {database} from './supabase';
export type BulkResult={processed:string[];skipped:string[];failed:string[];error?:string};
export async function performBulkApplications(db:Awaited<ReturnType<typeof database>>,input:unknown):Promise<BulkResult>{
 const result:{processed:string[];skipped:string[];failed:string[];error?:string}={processed:[],skipped:[],failed:[]};
 const {z}=await import('zod');const parsed=z.object({ids:z.array(z.string().uuid()).min(1).max(1000),operation:z.enum(['paid','cancel','contacted']),confirmed:z.boolean()}).safeParse(input);
 if(!parsed.success||parsed.data.operation==='cancel'&&!parsed.data.confirmed)return {...result,error:'대상과 처리 종류를 확인하고, 취소 시 취소 확인란을 체크해주세요.'};
 const ids=[...new Set(parsed.data.ids)];
 try{
  const {data:{user}}=await db.auth.getUser();if(!user)return {...result,error:'관리자 로그인이 필요합니다.'};
  const {data:admin}=await db.rpc('is_admin');if(admin!==true)return {...result,error:'관리자 권한이 필요합니다.'};
  const {data:sessions,error:sessionError}=await db.rpc('session_list');if(sessionError||!Array.isArray(sessions))return {...result,error:'회차 정보를 확인하지 못했습니다. 변경하지 않았습니다.'};
  const completedIds=new Set<string>(sessions.filter(s=>s.completed).map(s=>s.id));
  const {bulkEligible}=await import('@/lib/bulk-applications');
  const rows:import('@/lib/bulk-applications').BulkApplication[]=[];
  for(let start=0;start<ids.length;start+=100){
   const {data,error}=await db.from('applications').select('id,session_id,people,status,payment,notice').in('id',ids.slice(start,start+100));
   if(error)return {...result,error:'신청 정보를 확인하지 못했습니다. 변경하지 않았습니다.'};rows.push(...data);
  }
  for(const id of ids){
   const row=rows.find(r=>r.id===id);
   if(!row){result.failed.push(id);continue;}
   if(!bulkEligible(row,parsed.data.operation,completedIds)){result.skipped.push(id);continue;}
   const {error}=await db.rpc('manage_application',{payload:{id,operation:parsed.data.operation}});
   if(error)result.failed.push(id);else result.processed.push(id);
  }
  return result;
 }catch{return {...result,error:'연결이 끊겨 일부 결과를 확인하지 못했습니다. 새로고침 후 현재 상태를 확인해주세요.'};}
}

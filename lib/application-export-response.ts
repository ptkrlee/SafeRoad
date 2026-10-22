import {NextResponse} from 'next/server';
import {z} from 'zod';
import type {database} from './supabase';
import {applicationWorkbook,type ExportApplication} from './application-export';
import type {Session} from './domain';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
const failure=(message:string,status:number)=>NextResponse.json({error:message},{status,headers});
export async function applicationExportResponse(request:Request,db:Awaited<ReturnType<typeof database>>){
 try{
  const {data:{user}}=await db.auth.getUser();
  if(!user)return failure('관리자 로그인이 필요합니다.',401);
  const {data:admin,error:authError}=await db.rpc('is_admin');
  if(authError||admin!==true)return failure('관리자만 명단을 다운로드할 수 있습니다.',403);
  const parsed=z.string().uuid().safeParse(new URL(request.url).searchParams.get('session'));
  if(!parsed.success)return failure('다운로드할 회차를 선택해주세요.',400);
  const {data:sessions,error}=await db.rpc('session_list');
  if(error||!Array.isArray(sessions))return failure('회차 정보를 불러오지 못했습니다.',503);
  const session=(sessions as Session[]).find(s=>s.id===parsed.data);
  if(!session)return failure('해당 회차가 없습니다.',404);
  const rows:ExportApplication[]=[];
  for(let offset=0;;offset+=1000){
   const {data,error}=await db.from('applications').select('id,original_session_id,name,phone,address,people,depositor,total,status,payment,refund,notice,created_at,source,moved').eq('session_id',session.id).order('created_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+999);
   if(error)return failure('명단을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',503);
   rows.push(...(data||[]) as ExportApplication[]);
   if(!data||data.length<1000)break;
  }
  const body=await applicationWorkbook(session,rows,new Map((sessions as Session[]).map(s=>[s.id,s.date])));
  const filename=`오륙도_신청자명단_${session.date}.xlsx`;
  return new NextResponse(body,{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="participants-${session.date}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`}});
 }catch{return failure('엑셀 파일을 만들지 못했습니다. 로그인 상태와 연결을 확인한 뒤 다시 시도해주세요.',503);}
}

import {sameOriginRequest} from '@/lib/same-origin';
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {editLookupSchema,participantEditSchema} from '@/lib/application-edit-schema';
import {createEditToken,editCookie,editLimitKey,verifyEditPin,verifyEditToken,type EditAccess} from '@/lib/application-edit-security';
import {applicationEditConfigured,applicationEditDatabase,applicationEditError} from '@/lib/application-edit-server';
import {revalidatePath} from 'next/cache';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers});
const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/api/application-edit',maxAge:20*60};
async function access(){const value=(await cookies()).get(editCookie)?.value;return value?verifyEditToken(value,process.env.SUPABASE_SECRET_KEY!):null;}
export async function GET(){
 if(!applicationEditConfigured())return reply({error:'신청 변경 기능을 준비하고 있습니다. 사무국(010-9679-9817, 문자 연락)으로 문의해주세요.'},503);
 try{const entries=await access();if(!entries)return reply({applications:[]},401);const{data,error}=await applicationEditDatabase().rpc('application_edit_records',{accesses:entries});if(error)return reply({error:'신청내역을 불러오지 못했습니다. 다시 조회해주세요.'},503);return reply({applications:data});}catch{return reply({error:'연결을 확인한 뒤 다시 조회해주세요.'},503);}
}
export async function POST(request:Request){
 if(!sameOriginRequest(request))return reply({error:'홈페이지에서 다시 시도해주세요.'},403);
 if(!applicationEditConfigured())return reply({error:'신청 변경 기능을 준비하고 있습니다. 사무국(010-9679-9817, 문자 연락)으로 문의해주세요.'},503);
 let input;try{if(Number(request.headers.get('content-length')||0)>12000)return reply({error:'입력 내용이 너무 깁니다.'},413);const body=await request.text();if(body.length>12000)throw new Error();input=JSON.parse(body);if(!input||typeof input!=='object'||Array.isArray(input))throw new Error();}catch{return reply({error:'입력 내용을 확인해주세요.'},400);}
 try{
  const db=applicationEditDatabase();
  if(input.operation==='logout'){(await cookies()).set(editCookie,'',{...cookieOptions,maxAge:0});return reply({ok:true});}
  if(input.operation==='lookup'){
   const parsed=editLookupSchema.safeParse(input);if(!parsed.success)return reply({error:'전화번호와 숫자 4~12자리 비밀번호를 확인해주세요.'},400);
   const{phone,pin}=parsed.data;const secret=process.env.SUPABASE_SECRET_KEY!;
   const phoneKey=editLimitKey('phone',phone,secret);const ipKey=editLimitKey('ip',request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown',secret);
   for(const[key,max]of [[ipKey,30],[phoneKey,5]] as const){const limit=await db.rpc('application_edit_limit',{input_key:key,max_attempts:max,clear_success:false});if(limit.error)return reply({error:'신청 변경 기능을 준비하고 있습니다. 잠시 후 다시 확인해주세요.'},503);if(limit.data!==true)return reply({error:'조회 시도가 많습니다. 15분 후 다시 시도하거나 사무국에 문의해주세요.'},429);}
   const{data,error}=await db.rpc('application_edit_candidates',{input_phone:phone});if(error)return reply({error:'신청내역을 조회하지 못했습니다. 잠시 후 다시 시도해주세요.'},503);
   const matches:EditAccess[]=[];for(const c of data||[])if(await verifyEditPin(pin,c.pin_hash))matches.push({id:c.id,version:c.access_version});
   if(!data?.length)await verifyEditPin(pin,'scrypt$'+ '0'.repeat(32)+'$'+'0'.repeat(64));
   if(!matches.length){(await cookies()).set(editCookie,'',{...cookieOptions,maxAge:0});return reply({error:'전화번호 또는 비밀번호를 확인해주세요. 비밀번호를 설정하지 않은 기존 신청이나 비밀번호 분실은 사무국(010-9679-9817, 문자 연락)으로 문의해주세요.'},401);}
   const records=await db.rpc('application_edit_records',{accesses:matches});if(records.error)return reply({error:'신청내역을 불러오지 못했습니다.'},503);
   await db.rpc('application_edit_limit',{input_key:phoneKey,max_attempts:5,clear_success:true});
   (await cookies()).set(editCookie,createEditToken(matches,secret),cookieOptions);return reply({applications:records.data});
  }
  if(input.operation==='save'){
   const parsed=participantEditSchema.safeParse(input);if(!parsed.success)return reply({error:parsed.error.issues[0].message},400);
   const entries=await access();const granted=entries?.find(a=>a.id===parsed.data.id);if(!granted)return reply({error:'확인 시간이 만료되었습니다. 전화번호와 비밀번호로 다시 조회해주세요.'},401);
   const{data,error}=await db.rpc('edit_application_participant',{payload:parsed.data,access_version:granted.version});if(error)return reply({error:applicationEditError(error.message)},409);
   revalidatePath('/');revalidatePath('/admin');const records=await db.rpc('application_edit_records',{accesses:entries});return reply({ok:true,result:data,applications:records.data||[]});
  }
  return reply({error:'요청을 확인해주세요.'},400);
 }catch{return reply({error:'처리 결과를 확인하지 못했습니다. 중복 저장 전에 다시 조회해주세요.'},503);}
}

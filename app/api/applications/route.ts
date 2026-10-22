import {sameOriginRequest} from '@/lib/same-origin';
import {applicationWithPinSchema} from '@/lib/application-edit-schema';
import {hashEditPin} from '@/lib/application-edit-security';
import {applicationEditConfigured,applicationEditDatabase} from '@/lib/application-edit-server';
import { NextResponse } from 'next/server';
import { applicationSchema } from '@/lib/domain';
import { configured, database } from '@/lib/supabase';
export async function POST(request:Request) {
 if(!configured()) return NextResponse.json({error:'신청 시스템 준비 중입니다. 현재 접수되지 않습니다.'},{status:503});
 if(!sameOriginRequest(request)) return NextResponse.json({error:'홈페이지에서 다시 신청해주세요.'},{status:403});
 if(Number(request.headers.get('content-length')||0)>12000) return NextResponse.json({error:'입력 내용이 너무 깁니다.'},{status:413});
 let raw; try {const text=await request.text(); if(text.length>12000) throw new Error();raw=JSON.parse(text);} catch {return NextResponse.json({error:'신청 정보를 확인해주세요.'},{status:400});}
 const parsed=applicationSchema.safeParse(raw);
 if(!parsed.success || !Number.isSafeInteger(raw.policyVersion)) return NextResponse.json({error:parsed.error?.issues[0]?.message||'동의문을 다시 확인해주세요.'},{status:400});
 try { const db=await database();const settings=await db.from('settings').select('*').eq('id',1).single();if(settings.error||settings.data?.consent_revision!==4)return NextResponse.json({error:'신청 안내 업데이트 중입니다. 잠시 후 다시 확인해주세요.'},{status:503});let data;let error;
 if(settings.data.application_edit_ready===true){
  if(!applicationEditConfigured())return NextResponse.json({error:'신청 변경용 인증 설정을 준비하고 있습니다. 잠시 후 다시 신청해주세요.'},{status:503});
  const secured=applicationWithPinSchema.safeParse(raw);if(!secured.success)return NextResponse.json({error:secured.error.issues[0].message},{status:400});
  const {editPin,...fields}=secured.data;const result=await applicationEditDatabase().rpc('submit_application_with_access',{payload:{...fields,policyVersion:raw.policyVersion},access_hash:await hashEditPin(editPin)});data=result.data;error=result.error;
 }else{const result=await db.rpc('submit_application',{payload:{...parsed.data,policyVersion:raw.policyVersion}});data=result.data;error=result.error;}
 if(error) return NextResponse.json({error:'접수가 마감되었거나 정원·안내 정책이 변경되었습니다. 새로고침 후 다시 확인해주세요.'},{status:409});
 return NextResponse.json(data,{status:201,headers:{'Cache-Control':'no-store'}});
 } catch {return NextResponse.json({error:'접수 결과를 확인하지 못했습니다. 중복 신청 전에 사무국(010-9679-9817, 문자 연락)에 문의해주세요.'},{status:503});}
}

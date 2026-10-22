import {NextResponse} from 'next/server';
import {configured,database} from '@/lib/supabase';
import {applicationExportResponse} from '@/lib/application-export-response';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
 try{if(configured())return await applicationExportResponse(request,await database());}catch{}
 return NextResponse.json({error:'데이터베이스 연결과 로그인 상태를 확인해주세요.'},{status:503,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
}

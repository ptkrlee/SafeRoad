import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const ADMIN='10000000-0000-4000-8000-000000000001',OTHER='10000000-0000-4000-8000-000000000002';
test('PostgreSQL: 권한·정원·날짜 변경·회차 취소·환불·이력',async(t)=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${ADMIN}'),('${OTHER}'); insert into private.admins values('${ADMIN}');`);
  async function role(user:string|null){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec(user?'set role authenticated':'set role anon');}
  async function rpc(name:string,payload:object){return (await db.query<{result:any}>(`select public.${name}($1::jsonb) as result`,[JSON.stringify(payload)])).rows[0].result;}
  const form=(sessionId:string,name='가상참가자',people=2)=>({sessionId,name,address:'부산 남구',phone:'01012345678',people,depositor:'가상입금자',feeConsent:true,refundConsent:true,privacyConsent:true,website:'',policyVersion:2});
  await t.test('권한 없는 사용자는 조회·설정을 변경할 수 없다',async()=>{
   await role(OTHER);assert.equal((await db.query('select * from public.applications')).rows.length,0);
   await assert.rejects(()=>rpc('manage_session',{id:A,operation:'cancel'}),/FORBIDDEN/);
   await role(null);await assert.rejects(()=>rpc('submit_application',form(A)),/CLOSED/);
   await assert.rejects(()=>db.exec('select * from public.applications'),/permission denied/);
   await assert.rejects(()=>db.exec("update public.sessions set accepting=true"),/permission denied/);
  });
  await t.test('최종 정책·시간·코스 없이 접수를 열 수 없다',async()=>{
   await role(ADMIN);
   await assert.rejects(()=>rpc('manage_session',{id:A,operation:'save',capacity:30,accepting:true,start_time:'09:00',course:'해파랑길',notice_date:'2026-10-22'}),/NOT_READY/);
   await rpc('save_settings',{holder:'부산치유협회',privacy_text:'시험용 개인정보 동의문입니다. 이름 연락처 주소지 입금자명 인원을 수집합니다.',refund_text:'시험용 환불 정책입니다. 운영 취소 시 전액 환불하며 신청 취소는 사무국으로 문의합니다.',published:true});
   await assert.rejects(()=>rpc('manage_session',{id:A,operation:'save',capacity:30,accepting:true,start_time:'',course:'',notice_date:'2026-10-22'}),/NOT_READY/);
   for(const id of [A,B])await rpc('manage_session',{id,operation:'save',capacity:30,accepting:true,start_time:'09:00',course:'해파랑길',notice_date:id===A?'2026-10-22':'2026-11-13'});
  });
  let applicationId:string;
  await t.test('신청·정책 버전·중복·정원 제한을 서버에서 검증한다',async()=>{
   await role(null);
   await assert.rejects(()=>rpc('submit_application',{...form(A),privacyConsent:false}),/CONSENT/);
   await assert.rejects(()=>rpc('submit_application',{...form(A),policyVersion:1}),/CONSENT/);
   const result=await rpc('submit_application',form(A));applicationId=result.id;
   assert.equal(result.holder,'부산치유협회');assert.equal(result.total,20000);assert.equal(result.noticeDate,'2026-10-22');
   await assert.rejects(()=>rpc('submit_application',form(A)),/DUPLICATE/);
   await assert.rejects(()=>rpc('submit_application',form(A,'정원초과가상',29)),/CAPACITY/);
   await role(OTHER);assert.equal((await db.query('select * from public.applications')).rows.length,0);
   await assert.rejects(()=>rpc('manage_application',{id:applicationId,operation:'paid'}),/FORBIDDEN/);
  });
  await t.test('날짜 변경자는 새 회차 명단·취소 대상에 포함되며 이력이 남는다',async()=>{
   await role(ADMIN);
   await rpc('manage_application',{id:applicationId,operation:'paid'});
   await rpc('manage_application',{id:applicationId,operation:'contacted'});
   await rpc('manage_application',{id:applicationId,operation:'move',target:B});
   let row=(await db.query<any>('select * from public.applications where id=$1',[applicationId])).rows[0];
   assert.equal(row.original_session_id,A);assert.equal(row.session_id,B);assert.equal(row.moved,true);assert.equal(row.notice,'needed');
   const sessions=await db.query<{s:any}>('select public.session_list() as s');
   assert.equal(sessions.rows.find(r=>r.s.id===A)?.s.booked,0);assert.equal(sessions.rows.find(r=>r.s.id===B)?.s.booked,2);
   await rpc('manage_application',{id:applicationId,operation:'contacted'});
   await rpc('manage_session',{id:B,operation:'cancel'});
   row=(await db.query<any>('select * from public.applications where id=$1',[applicationId])).rows[0];
   assert.equal(row.status,'cancelled');assert.equal(row.notice,'needed');assert.equal(row.refund,'pending');
   await role(null);await assert.rejects(()=>rpc('submit_application',form(B,'취소회차신청')),/CLOSED/);
   await role(ADMIN);await rpc('manage_application',{id:applicationId,operation:'refund'});
   row=(await db.query<any>('select * from public.applications where id=$1',[applicationId])).rows[0];assert.equal(row.refund,'completed');
   await assert.rejects(()=>rpc('manage_application',{id:applicationId,operation:'move',target:A}),/INVALID_MOVE/);
   const logs=(await db.query<any>('select * from public.audit_log where entity_id=$1 order by id',[applicationId])).rows;
   assert.ok(logs.length>=7);assert.equal(logs.at(-1).detail.refund,'completed');
   assert.ok(logs.some(l=>l.detail.moved===true&&l.detail.session===B&&l.detail.before.session===A));
   assert.ok(!JSON.stringify(logs).includes('01012345678'));
  });
 } finally {await db.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {refundPolicy,privacyPolicy,photoPolicy} from '../lib/policies';
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003';
const ADMIN='10000000-0000-4000-8000-000000000001',OTHER='10000000-0000-4000-8000-000000000002';
test('업그레이드 SQL: 기존 기록 보존, 사진 선택 동의, 관리자 가져오기와 재실행 중복 방지',async(t)=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${ADMIN}'),('${OTHER}'); insert into private.admins values('${ADMIN}');`);
  const migration=await readFile(new URL('../supabase/03-consent-import.sql',import.meta.url),'utf8');
  await db.exec(migration);
  async function role(user:string|null){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec(user?'set role authenticated':'set role anon');}
  async function rpc(name:string,payload:object){return(await db.query<{result:any}>(`select public.${name}($1::jsonb) as result`,[JSON.stringify(payload)])).rows[0].result;}
  const createdAt=new Date(Date.now()-86400000).toISOString();
  function legacy(n:number,people=1){return {sourceKey:createHash('sha256').update('fixture-'+n).digest('hex'),originalRow:n+2,name:'가상참가'+n,address:'부산 남구',phone:'0100000'+String(n).padStart(4,'0'),people,createdAt,privacyEvidence:'Y',refundEvidence:'네, 확인했습니다.',responseModified:n===1};}
  const rows=[legacy(1,2),legacy(2),legacy(3)];
  await t.test('익명·비관리자는 가져오거나 명단을 조회할 수 없다',async()=>{
   await role(null);await assert.rejects(()=>rpc('import_legacy_applications',{sessionId:B,rows}),/permission denied/);
   await role(OTHER);await assert.rejects(()=>rpc('import_legacy_applications',{sessionId:B,rows}),/FORBIDDEN/);assert.equal((await db.query('select * from public.applications')).rows.length,0);
  });
  await t.test('마감된 회차에도 기존 신청 3건 4명을 보존해 등록하고 상태를 추정하지 않는다',async()=>{
   await role(ADMIN);assert.deepEqual(await rpc('import_legacy_applications',{sessionId:B,rows}),{inserted:3,skipped:0});
   const apps=(await db.query<any>('select * from public.applications order by name')).rows;assert.equal(apps.length,3);assert.equal(apps.reduce((n,a)=>n+a.people,0),4);
   for(const a of apps){assert.equal(a.payment,'unconfirmed');assert.equal(a.depositor,'원본 미기재');assert.equal(a.photo_consent,null);assert.equal(a.photo_consent_at,null);assert.equal(a.policy_version,0);assert.equal(a.source,'naver');assert.match(a.privacy_snapshot,/새 홈페이지 약관과 사진 동의로 간주하지 않습니다/);assert.equal(new Date(a.created_at).toISOString(),createdAt);}
   assert.equal(apps[0].legacy_response_modified,true);
   assert.deepEqual(await rpc('import_legacy_applications',{sessionId:B,rows}),{inserted:0,skipped:3});
  });
  await t.test('이동·취소한 신청은 재가져와도 되살아나거나 원래 회차로 복제되지 않는다',async()=>{
   await rpc('save_settings',{holder:'부산치유협회',privacy_text:privacyPolicy,refund_text:refundPolicy,photo_text:photoPolicy,published:true});
   await rpc('manage_session',{id:A,operation:'save',capacity:30,accepting:true,start_time:'09:30',course:'해파랑길',notice_date:'2026-10-22'});
   const apps=(await db.query<any>('select * from public.applications order by name')).rows;
   await rpc('manage_application',{id:apps[0].id,operation:'move',target:A});await rpc('manage_application',{id:apps[1].id,operation:'cancel'});
   assert.deepEqual(await rpc('import_legacy_applications',{sessionId:B,rows}),{inserted:0,skipped:3});
   assert.equal((await db.query<any>('select session_id from public.applications where id=$1',[apps[0].id])).rows[0].session_id,A);
   assert.equal((await db.query<any>('select status from public.applications where id=$1',[apps[1].id])).rows[0].status,'cancelled');
  });
  await t.test('새 신청은 사진 비동의를 허용하고 선택·동의문·시각을 기록한다',async()=>{
   const version=(await db.query<any>('select version from public.settings')).rows[0].version;
   const data={sessionId:A,name:'신규가상참가자',address:'부산 남구',phone:'01011110000',people:1,depositor:'가상입금자',feeConsent:true,refundConsent:true,privacyConsent:true,website:'',policyVersion:version};
   await role(null);
   await assert.rejects(()=>rpc('submit_application',{...data,policyVersion:version-1}),/CONSENT/);
   await assert.rejects(()=>rpc('submit_application',{...data,photoConsent:'true'}),/PHOTO_CONSENT/);
   const rejected=await rpc('submit_application',{...data,photoConsent:false});assert.equal(rejected.refundDeadline,'2026-10-20');
   const accepted=await rpc('submit_application',{...data,name:'사진동의가상참가자',phone:'01011110001',photoConsent:true});
   await role(ADMIN);for(const [id,choice]of [[rejected.id,false],[accepted.id,true]]){const row=(await db.query<any>('select * from public.applications where id=$1',[id])).rows[0];assert.equal(row.photo_consent,choice);assert.equal(row.photo_policy_snapshot,photoPolicy);assert.ok(row.photo_consent_at);}
  });
  await t.test('정원 초과·동의 없는 행은 전체 요청을 롤백하고 재실행은 기존 데이터를 보존한다',async()=>{
   await role(ADMIN);await rpc('manage_session',{id:C,operation:'save',capacity:10,accepting:false,start_time:'09:30',course:'해파랑길',notice_date:'2026-11-20'});
   await assert.rejects(()=>rpc('import_legacy_applications',{sessionId:C,rows:[legacy(11,6),legacy(12,6)]}),/CAPACITY/);
   assert.equal((await db.query('select * from public.applications where session_id=$1',[C])).rows.length,0);
   await assert.rejects(()=>rpc('import_legacy_applications',{sessionId:C,rows:[legacy(11),{...legacy(12),privacyEvidence:'N'}]}),/MISSING_LEGACY_CONSENT/);
   assert.equal((await db.query('select * from public.applications where session_id=$1',[C])).rows.length,0);
   const before=(await db.query<any>('select count(*) as n from public.applications')).rows[0].n;const version=(await db.query<any>('select version from public.settings')).rows[0].version;
   await db.exec('reset role');await db.exec(migration);assert.equal((await db.query<any>('select count(*) as n from public.applications')).rows[0].n,before);assert.equal((await db.query<any>('select version from public.settings')).rows[0].version,version);
  });
 }finally{await db.close();}
});

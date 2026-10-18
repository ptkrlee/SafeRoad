import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createHash} from 'node:crypto';
const ADMIN='10000000-0000-4000-8000-000000000001',OTHER='10000000-0000-4000-8000-000000000002';
test('종료 회차: 권한·실제 완료 구분·원본 신청 보존·재가져오기·입금과 참석 분리',async(t)=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 for(const file of ['schema.sql','03-consent-import.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
 await db.exec(`insert into auth.users values('${ADMIN}'),('${OTHER}');insert into private.admins values('${ADMIN}');`);
 const migration=await readFile(new URL('../supabase/06-completed-sessions.sql',import.meta.url),'utf8');await db.exec(migration);
 async function role(user:string|null){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec(user?'set role authenticated':'set role anon');}
 async function rpc(name:string,payload:object){return(await db.query<{r:any}>(`select public.${name}($1::jsonb) as r`,[JSON.stringify(payload)])).rows[0].r;}
 const dates=(await db.query<{past:string;future:string;created:string}>("select ((now() at time zone 'Asia/Seoul')::date-10)::text as past,((now() at time zone 'Asia/Seoul')::date+100)::text as future,(now()-interval '20 days')::text as created")).rows[0];
 const payload={date:dates.past,course:'가상 해파랑길',capacity:1,start_time:'09:30',confirmed:true};let sid='';let app:any;
 await t.test('익명·비관리자 등록과 미래·중복·미확인 완료 표시를 거부한다',async()=>{
 await role(null);await assert.rejects(()=>rpc('archive_session',payload),/permission denied/);await role(OTHER);await assert.rejects(()=>rpc('archive_session',payload),/FORBIDDEN/);await role(ADMIN);await assert.rejects(()=>rpc('archive_session',{...payload,confirmed:false}),/CONFIRM_COMPLETION/);await assert.rejects(()=>rpc('archive_session',{...payload,date:dates.future}),/INVALID_HISTORY/);await rpc('archive_session',payload);await assert.rejects(()=>rpc('archive_session',payload),/DATE_EXISTS/);
 const s=(await db.query<any>('select * from public.sessions where date=$1',[dates.past])).rows[0];sid=s.id;assert.equal(s.completed,true);assert.equal(s.accepting,false);assert.equal(s.cancelled,false);assert.equal(s.capacity,1);assert.equal((await db.query("select * from public.audit_log where operation='ARCHIVE_CREATE'")).rows.length,1);
 });
 await t.test('지난 신청의 응답시각·동의는 보존하고 참석·입금·연락은 자동 확인하지 않는다',async()=>{
 const row={sourceKey:createHash('sha256').update('history-fixture').digest('hex'),name:'가상 지난신청자',address:'부산 남구',phone:'01000000001',people:2,createdAt:dates.created,privacyEvidence:'Y',refundEvidence:'네, 확인했습니다.',responseModified:false};
 assert.deepEqual(await rpc('import_legacy_applications',{sessionId:sid,rows:[row]}),{inserted:1,skipped:0});app=(await db.query<any>('select * from public.applications where session_id=$1',[sid])).rows[0];assert.equal(app.payment,'unconfirmed');assert.equal(app.status,'active');assert.equal(app.notice,'needed');assert.equal(app.photo_consent,null);assert.equal(new Date(app.created_at).getTime(),new Date(dates.created).getTime());
 await rpc('manage_application',{id:app.id,operation:'attended'});assert.deepEqual(await rpc('import_legacy_applications',{sessionId:sid,rows:[row]}),{inserted:0,skipped:1});let updated=(await db.query<any>('select * from public.applications where id=$1',[app.id])).rows[0];assert.equal(updated.status,'attended');assert.equal(updated.payment,'unconfirmed');assert.equal(updated.privacy_snapshot,app.privacy_snapshot);
 await rpc('manage_application',{id:app.id,operation:'no_show'});await rpc('manage_application',{id:app.id,operation:'attendance_unknown'});updated=(await db.query<any>('select * from public.applications where id=$1',[app.id])).rows[0];assert.equal(updated.status,'active');assert.equal(updated.payment,'unconfirmed');
 });
 await t.test('종료 회차는 접수·이동·취소로 잘못 처리하지 않으며 종료 표시 해제도 명단을 보존한다',async()=>{
 await assert.rejects(()=>rpc('manage_session',{id:sid,operation:'save',capacity:30,accepting:true,start_time:'09:30',course:'가상코스',notice_date:dates.past}),/NOT_READY/);await assert.rejects(()=>rpc('manage_session',{id:sid,operation:'cancel'}),/COMPLETED_SESSION/);await assert.rejects(()=>rpc('manage_application',{id:app.id,operation:'move',target:'00000000-0000-4000-8000-000000000001'}),/COMPLETED_SESSION/);
 await rpc('manage_session',{id:sid,operation:'completion_unknown'});assert.equal((await db.query<any>('select completed from public.sessions where id=$1',[sid])).rows[0].completed,false);await assert.rejects(()=>rpc('manage_application',{id:app.id,operation:'attended'}),/INVALID_ATTENDANCE/);await assert.rejects(()=>rpc('manage_session',{id:sid,operation:'complete'}),/INVALID_COMPLETION/);await rpc('manage_session',{id:sid,operation:'complete',confirmed:true});assert.equal((await db.query('select * from public.applications where id=$1',[app.id])).rows.length,1);
 });
 await t.test('익명은 종료 일정만 확인하며 개인정보는 읽을 수 없고 재실행도 사본을 보존한다',async()=>{
 await role(null);const sessions=(await db.query<{r:any}>('select public.session_list() as r')).rows;assert.equal(sessions.find(s=>s.r.id===sid)?.r.completed,true);await assert.rejects(()=>db.query('select * from public.applications'),/permission denied/);
 await role(ADMIN);const before=(await db.query<any>('select version from public.settings')).rows[0].version;const current=(await db.query<any>('select refund_text from public.settings')).rows[0].refund_text;assert.match(current,/사무국\(010-9679-9817, 문자 연락\)/);await db.exec('reset role');await db.exec(migration);assert.equal((await db.query<any>('select version from public.settings')).rows[0].version,before);assert.equal((await db.query<any>('select privacy_snapshot from public.applications where id=$1',[app.id])).rows[0].privacy_snapshot,app.privacy_snapshot);
 });
 }finally{await db.close();}
});

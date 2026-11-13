import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {applicationNoteSchema} from '../lib/application-notes';
const admin='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const app='20000000-0000-4000-8000-000000000001',round='00000000-0000-4000-8000-000000000002';
const key=(n:number)=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('contact notes stay staff-only, append with timestamps, preserve status, survive reinstall and retry without duplicates',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;`);
 for(const file of ['01-tables.sql','02-functions.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
 await db.query('insert into auth.users values($1),($2)',[admin,other]);await db.query('insert into private.admins values($1)',[admin]);
 await db.query("insert into public.applications(id,session_id,original_session_id,name,address,phone,people,depositor,total,policy_version,privacy_snapshot,refund_snapshot) values($1,$2,$2,'가상 신청자','가상 지역','01000000000',1,'가상 입금자',10000,1,'기존 동의','기존 환불')",[app,round]);
 const migration=await readFile(new URL('../supabase/10-application-notes.sql',import.meta.url),'utf8');await db.exec(migration);
 const role=async(user:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec('set role '+(user?'authenticated':'anon'));};
 const add=async(body:string,n:number)=> (await db.query<{note:any}>('select public.add_application_note($1,$2,$3) note',[app,body,key(n)])).rows[0].note;
 const summaries=async()=> (await db.query<{notes:any[]}>('select public.application_note_summaries($1::uuid[]) notes',[[app]])).rows[0].notes;
 await role(null);await assert.rejects(()=>add('불허',1),/permission denied/);await assert.rejects(()=>summaries(),/permission denied/);await assert.rejects(db.query('select * from public.application_notes'),/permission denied/);
 await role(other);assert.equal((await db.query('select * from public.application_notes')).rows.length,0);await assert.rejects(()=>add('불허',1),/FORBIDDEN/);await assert.rejects(()=>summaries(),/FORBIDDEN/);
 await role(admin);const saved=await add('  전화 부재\n입금 안내 문자 발송  ',1);assert.equal(saved.body,'전화 부재\n입금 안내 문자 발송');assert(saved.created_at);assert.equal((await add('전화 부재\n입금 안내 문자 발송',1)).id,saved.id);await assert.rejects(()=>add('다른 내용',1),/NOTE_CONFLICT/);
 for(let n=2;n<=7;n++)await add('추가 연락 기록 '+n,n);
 const [summary]=await summaries();assert.equal(summary.total,7);assert.equal(summary.notes.length,5);assert.equal(summary.notes[0].body,'추가 연락 기록 7');
 const older=await db.query('select body from public.application_notes where application_id=$1 and id<$2 order by id desc limit 20',[app,summary.notes[4].id]);assert.equal(older.rows.length,2);
 const application=(await db.query<any>('select * from public.applications where id=$1',[app])).rows[0];assert.equal(application.payment,'unconfirmed');assert.equal(application.notice,'needed');assert.equal(application.status,'active');
 await assert.rejects(()=>add(' ',8),/INVALID_NOTE/);await assert.rejects(()=>add('a'.repeat(1001),8),/INVALID_NOTE/);
 await assert.rejects(db.query("update public.application_notes set body='변조'"),/permission denied/);await assert.rejects(db.query('delete from public.application_notes'),/permission denied/);
 await db.exec('reset role');await db.exec(migration);await role(admin);assert.equal((await summaries())[0].total,7);
 const audit=await db.query<any>("select detail from public.audit_log where operation='ADMIN_NOTE_ADDED'");assert.equal(audit.rows.length,7);assert(!JSON.stringify(audit.rows).includes('전화 부재'));
 await role(other);assert.equal((await db.query('select * from public.application_notes')).rows.length,0);
 }finally{await db.close();}
});
test('note input rejects blank/oversized text and retains meaningful line breaks as plain text',()=>{
 const base={applicationId:app,requestId:key(1)};for(const body of ['',' \n ','a'.repeat(1001)])assert.equal(applicationNoteSchema.safeParse({...base,body}).success,false);
 assert.equal(applicationNoteSchema.parse({...base,body:' 전화 부재\n문자 발송 '}).body,'전화 부재\n문자 발송');
});

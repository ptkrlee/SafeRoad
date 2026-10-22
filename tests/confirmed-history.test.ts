import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('confirmed first five rounds are idempotent and preserve existing round details and other dates',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of ['schema.sql','03-consent-import.sql','06-completed-sessions.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  await db.exec(`insert into public.sessions(date,course,capacity,minimum,accepting) values('2026-04-25','기존 코스',40,15,false),('2026-10-18','기존 6회차',30,10,false);`);
  const script=await readFile(new URL('../supabase/07-confirmed-history.sql',import.meta.url),'utf8');
  await db.exec(script);
  const first=(await db.query("select *,to_char(date,'YYYY-MM-DD') as date_text from public.sessions order by date")).rows;
  assert.equal(first.filter((s:any)=>s.completed).length,5);
  const existing=first.find((s:any)=>s.date_text==='2026-04-25') as any;
  assert.equal(existing.course,'기존 코스');assert.equal(existing.capacity,40);assert.equal(existing.minimum,15);
  assert.equal((first.find((s:any)=>s.date_text==='2026-10-18') as any).completed,false);
  const audit=(await db.query("select count(*)::int as n from public.audit_log where operation='CONFIRMED_HISTORY'")).rows;
  await db.exec(await readFile(new URL('../docs/운영완료-5회차-등록.sql',import.meta.url),'utf8'));
  assert.deepEqual((await db.query("select *,to_char(date,'YYYY-MM-DD') as date_text from public.sessions order by date")).rows,first);
  assert.deepEqual((await db.query("select count(*)::int as n from public.audit_log where operation='CONFIRMED_HISTORY'")).rows,audit);
  await db.exec(`update public.sessions set completed=false,cancelled=true where date='2026-05-09';`);
  await assert.rejects(db.exec(script),/취소로 기록된 회차/);
  await db.exec('rollback');
  assert.equal((await db.query<{cancelled:boolean}>("select cancelled from public.sessions where date='2026-05-09'")).rows[0].cancelled,true);
 }finally{await db.close();}
});

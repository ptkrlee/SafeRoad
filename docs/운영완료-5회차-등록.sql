-- Supabase SQL Editor에서 이 파일 전체를 한 번에 실행하세요.
-- 기존 3단계 설치 이후 사용합니다. 6단계를 이미 실행했어도 다시 실행할 수 있습니다.
-- 6단계 기능 준비 + 사용자 확인을 받은 1~5회차만 완료 등록합니다.
-- 참가 신청·입금·출석 기록과 10/18 이후 일정은 변경하지 않습니다.

-- Existing deployments: apply after 05. No existing participant records are deleted.
begin;
alter table public.sessions add column if not exists completed boolean not null default false;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='saferoad_completed_closed' and conrelid='public.sessions'::regclass) then
  alter table public.sessions add constraint saferoad_completed_closed check(not completed or (not accepting and not cancelled));
 end if;
end $$;
create or replace function public.archive_session(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare d date; n integer; result public.sessions;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'CONFIRM_COMPLETION'; end if;
 d:=(payload->>'date')::date;n:=(payload->>'capacity')::integer;
 if d is null or d>(now() at time zone 'Asia/Seoul')::date or n is null or n not between 1 and 500 or coalesce(length(trim(payload->>'course')),0) not between 2 and 150 then raise exception 'INVALID_HISTORY'; end if;
 if exists(select 1 from public.sessions where date=d) then raise exception 'DATE_EXISTS'; end if;
 insert into public.sessions(date,start_time,course,capacity,minimum,accepting,cancelled,completed)
 values(d,nullif(payload->>'start_time','')::time,trim(payload->>'course'),n,least(10,n),false,false,true) returning * into result;
 insert into public.audit_log(actor,entity,entity_id,operation,detail)
 values(auth.uid(),'sessions',result.id::text,'ARCHIVE_CREATE',to_jsonb(result));
end $$;
revoke all on function public.archive_session(jsonb) from public;
grant execute on function public.archive_session(jsonb) to authenticated;
create or replace function public.manage_session(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare s public.sessions; occupied integer;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 select * into s from public.sessions where id=(payload->>'id')::uuid for update;
 if s.id is null then raise exception 'NOT_FOUND'; end if;
 if payload->>'operation'='complete' then
  if s.cancelled or s.date>(now() at time zone 'Asia/Seoul')::date or payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'INVALID_COMPLETION'; end if;
  update public.sessions set completed=true,accepting=false where id=s.id;
 elsif payload->>'operation'='completion_unknown' then
  update public.sessions set completed=false,accepting=false where id=s.id;
 elsif payload->>'operation'='cancel' then
  if s.completed then raise exception 'COMPLETED_SESSION'; end if;
  update public.sessions set accepting=false,cancelled=true where id=s.id;
  update public.applications set status='cancelled',notice='needed',refund=case when payment='paid' then 'pending' else refund end where session_id=s.id and status='active';
 elsif payload->>'operation'='save' then
  select coalesce(sum(people),0) into occupied from public.applications where session_id=s.id and status in ('active','attended','no_show');
  if (payload->>'capacity')::integer<occupied then raise exception 'CAPACITY'; end if;
  if (payload->>'accepting')::boolean and (s.cancelled or s.completed or s.date<(now() at time zone 'Asia/Seoul')::date or not exists(select 1 from public.settings where id=1 and published) or nullif(trim(payload->>'course'),'') is null or nullif(payload->>'start_time','') is null or nullif(payload->>'notice_date','') is null) then raise exception 'NOT_READY'; end if;
  if not s.completed and (s.start_time is distinct from nullif(payload->>'start_time','')::time or s.course is distinct from nullif(trim(payload->>'course'),'') or s.notice_date is distinct from nullif(payload->>'notice_date','')::date) then
   update public.applications set notice='needed' where session_id=s.id and status='active';
  end if;
  update public.sessions set start_time=nullif(payload->>'start_time','')::time,course=nullif(trim(payload->>'course'),''),notice_date=nullif(payload->>'notice_date','')::date,capacity=(payload->>'capacity')::integer,accepting=(payload->>'accepting')::boolean where id=s.id;
 else raise exception 'UNKNOWN_OPERATION'; end if;
end $$;
create or replace function public.manage_application(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare a public.applications; target public.sessions; occupied integer;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 -- Same lock order for all mutations: sessions before applications.
 perform id from public.sessions order by id for update;
 select * into a from public.applications where id=(payload->>'id')::uuid for update;
 if a.id is null then raise exception 'NOT_FOUND'; end if;
 case payload->>'operation'
 when 'paid' then
  update public.applications set payment='paid',refund=case when status='cancelled' and refund='none' then 'pending' else refund end where id=a.id;
 when 'cancel' then
  if a.status not in ('active','cancelled') then raise exception 'INVALID_STATUS'; end if;
  update public.applications set status='cancelled',notice='needed',refund=case when payment='paid' and refund='none' then 'pending' else refund end where id=a.id;
 when 'refund' then
  if a.status<>'cancelled' or a.payment<>'paid' or a.refund<>'pending' then raise exception 'INVALID_REFUND'; end if;
  update public.applications set refund='completed' where id=a.id;
 when 'contacted' then update public.applications set notice='contacted' where id=a.id;
 when 'notice_needed' then update public.applications set notice='needed' where id=a.id;
 when 'attended','no_show','attendance_unknown' then
  if not exists(select 1 from public.sessions where id=a.session_id and completed) or a.status='cancelled' then raise exception 'INVALID_ATTENDANCE'; end if;
  update public.applications set status=case when payload->>'operation'='attendance_unknown' then 'active' else payload->>'operation' end where id=a.id;
 when 'move' then
  if exists(select 1 from public.sessions where id=a.session_id and completed) then raise exception 'COMPLETED_SESSION'; end if;
  select * into target from public.sessions where id=(payload->>'target')::uuid;
  if target.id is null or target.id=a.session_id or not target.accepting or target.cancelled or target.completed or target.date<(now() at time zone 'Asia/Seoul')::date or a.refund='completed' or a.status not in ('active','cancelled') then raise exception 'INVALID_MOVE'; end if;
  select coalesce(sum(people),0) into occupied from public.applications where session_id=target.id and status in ('active','attended','no_show');
  if occupied+a.people>target.capacity then raise exception 'CAPACITY'; end if;
  update public.applications set session_id=target.id,moved=true,status='active',refund='none',notice='needed' where id=a.id;
 else raise exception 'UNKNOWN_OPERATION'; end case;
end $$;

create or replace function public.import_legacy_applications(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sessions; c public.settings; r jsonb; occupied integer; inserted integer:=0; skipped integer:=0; original_time timestamptz; n integer;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if jsonb_typeof(payload->'rows') is distinct from 'array' then raise exception 'INVALID_ROWS'; end if;
 if jsonb_array_length(payload->'rows') not between 1 and 500 then raise exception 'INVALID_ROWS'; end if;
 select * into c from public.settings where id=1 for share;
 select * into s from public.sessions where id=(payload->>'sessionId')::uuid for update;
 if s.id is null or s.cancelled then raise exception 'INVALID_SESSION'; end if;
 select coalesce(sum(people),0) into occupied from public.applications where session_id=s.id and status in ('active','attended','no_show');
 for r in select value from jsonb_array_elements(payload->'rows') loop
  if r->>'sourceKey' is null or r->>'sourceKey' !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_SOURCE'; end if;
  if coalesce(length(trim(r->>'name')),0) not between 2 and 50 or coalesce(length(trim(r->>'address')),0) not between 2 and 100 or coalesce(r->>'phone','') !~ '^01[016789][0-9]{7,8}$' then raise exception 'INVALID_ROW'; end if;
  if coalesce(r->>'privacyEvidence','') !~* '^(Y|YES|동의|동의함|동의합니다[.]?|개인정보 수집 및 이용에 동의합니다[.]?)$' then raise exception 'MISSING_LEGACY_CONSENT'; end if;
  if length(r->>'privacyEvidence')>1000 or length(coalesce(r->>'refundEvidence',''))>1000 then raise exception 'INVALID_EVIDENCE'; end if;
  n:=(r->>'people')::integer; original_time:=(r->>'createdAt')::timestamptz;
  if n is null or n not between 1 and 30 or original_time is null or original_time>now()+interval '1 day' then raise exception 'INVALID_ROW'; end if;
  -- Preserve moved or cancelled registrations: re-import must not resurrect them.
  if exists(select 1 from public.applications a where a.legacy_key=r->>'sourceKey' or ((a.original_session_id=s.id or a.session_id=s.id) and a.name=trim(r->>'name') and a.phone=r->>'phone')) then
   skipped:=skipped+1;continue;
  end if;
  -- Historical signup records may include non-attendees; do not infer attendance from capacity.
  if not s.completed and occupied+n>s.capacity then raise exception 'CAPACITY'; end if;
  insert into public.applications(created_at,original_session_id,session_id,name,address,phone,people,depositor,total,policy_version,privacy_snapshot,refund_snapshot,source,legacy_key,legacy_response_modified)
  values(original_time,s.id,s.id,trim(r->>'name'),trim(r->>'address'),r->>'phone',n,'원본 미기재',n*10000,0,
   '기존 네이버폼 개인정보 동의 응답: '||(r->>'privacyEvidence')||'. 원본의 응답일시와 수정 표시를 함께 보존합니다. 수정 표시가 있으면 최초 동의 시각을 확정한 것으로 보지 않습니다. 새 홈페이지 약관과 사진 동의로 간주하지 않습니다. 상세 원문은 원본 설문에서 확인합니다.',
   '기존 네이버폼 취소·환불 안내 확인 응답: '||coalesce(r->>'refundEvidence','원본 확인 필요')||'. 새 홈페이지 정책으로 대체하지 않습니다.',
   'naver',r->>'sourceKey',coalesce((r->>'responseModified')::boolean,false));
  inserted:=inserted+1;occupied:=occupied+n;
 end loop;
 return jsonb_build_object('inserted',inserted,'skipped',skipped);
end $$;

-- Clarify office contact in CURRENT policy text only. Existing application snapshots remain untouched.
update public.settings set
 refund_text=regexp_replace(refund_text,'사무국(?![[:space:]]*\()','사무국(010-9679-9817, 문자 연락)','g'),
 privacy_text=regexp_replace(privacy_text,'사무국(?![[:space:]]*\()','사무국(010-9679-9817, 문자 연락)','g'),
 photo_text=regexp_replace(photo_text,'사무국(?![[:space:]]*\()','사무국(010-9679-9817, 문자 연락)','g'),
 version=version+1
where id=1 and (refund_text ~ '사무국(?![[:space:]]*\()' or privacy_text ~ '사무국(?![[:space:]]*\()' or photo_text ~ '사무국(?![[:space:]]*\()');
commit;
select '6단계 완료' as result;

-- Confirmed by the operator: rounds 1–5 were actually completed.
-- Run after 06-completed-sessions.sql. Safe to rerun; signup/payment records are unchanged.
begin;
do $$ begin
 if exists(select 1 from public.sessions where date in ('2026-04-25','2026-05-09','2026-05-30','2026-09-19','2026-10-03') and cancelled) then
  raise exception '취소로 기록된 회차가 있습니다. 날짜와 실제 운영 여부를 확인해주세요. 변경하지 않았습니다.';
 end if;
end $$;
with confirmed(date,course) as (values
 ('2026-04-25'::date,'해파랑길 1코스 · 왕복 4km'),
 ('2026-05-09'::date,'남파랑길 1코스 · 왕복 6km'),
 ('2026-05-30'::date,'해파랑길 1코스 · 왕복 4km'),
 ('2026-09-19'::date,'남파랑길 1코스 · 왕복 6km'),
 ('2026-10-03'::date,'해파랑길 1코스 · 왕복 4km')
), changed as (
 insert into public.sessions(date,course,capacity,minimum,accepting,cancelled,completed)
 select date,course,30,10,false,false,true from confirmed
 on conflict(date) do update set
  accepting=false,completed=true,course=coalesce(public.sessions.course,excluded.course)
 where not public.sessions.completed
 returning *
)
insert into public.audit_log(actor,entity,entity_id,operation,detail)
select auth.uid(),'sessions',id::text,'CONFIRMED_HISTORY',to_jsonb(changed) from changed;
commit;
select '1~5회차 운영 완료 등록 완료' as result,
 count(*) filter(where completed and not cancelled) as confirmed_rounds
from public.sessions where date in ('2026-04-25','2026-05-09','2026-05-30','2026-09-19','2026-10-03');

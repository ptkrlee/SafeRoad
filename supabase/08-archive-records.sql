-- Completed-round operational spreadsheets may have missing fields.
-- Website and standard Naver-form registrations keep their required constraints.
begin;
alter table public.applications add column if not exists legacy_archive_data jsonb;
alter table public.applications add column if not exists legacy_imported_at timestamptz;
alter table public.applications alter column name drop not null,alter column address drop not null,alter column phone drop not null,
 alter column people drop not null,alter column depositor drop not null,alter column total drop not null,alter column created_at drop not null,
 alter column status drop not null,alter column payment drop not null,alter column refund drop not null,alter column notice drop not null;
alter table public.applications drop constraint if exists applications_name_check;
alter table public.applications drop constraint if exists applications_address_check;
alter table public.applications drop constraint if exists applications_phone_check;
alter table public.applications drop constraint if exists applications_people_check;
alter table public.applications drop constraint if exists applications_depositor_check;
alter table public.applications drop constraint if exists application_required_registration;
alter table public.applications add constraint application_required_registration check(source='naver_archive' or (
 name is not null and length(name) between 2 and 50 and address is not null and length(address) between 2 and 100
 and phone is not null and phone ~ '^01[016789][0-9]{7,8}$' and people is not null and people between 1 and 30
 and depositor is not null and length(depositor) between 2 and 50 and total is not null and created_at is not null
 and status is not null and payment is not null and refund is not null and notice is not null));
create or replace function private.import_archive_records(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sessions;r jsonb;inserted integer:=0;skipped integer:=0;n integer;t integer;applied timestamptz;
begin
 if jsonb_typeof(payload->'rows') is distinct from 'array' or jsonb_array_length(payload->'rows') not between 1 and 500 then raise exception 'INVALID_ROWS';end if;
 select * into s from public.sessions where id=(payload->>'sessionId')::uuid for update;
 if s.id is null or not s.completed or s.cancelled or s.date>(now() at time zone 'Asia/Seoul')::date then raise exception 'COMPLETED_SESSION_REQUIRED';end if;
 for r in select value from jsonb_array_elements(payload->'rows') loop
  if coalesce(r->>'sourceKey','') !~ '^[a-f0-9]{64}$' or coalesce((r->>'originalRow')::integer,0)<2 or jsonb_typeof(r->'original') is distinct from 'object' then raise exception 'INVALID_SOURCE';end if;
  if coalesce(length(r->>'name'),0)>1000 or coalesce(length(r->>'phone'),0)>1000 or coalesce(length(r->>'address'),0)>2000 or coalesce(length(r->>'depositor'),0)>1000 or length(coalesce(r->>'privacyEvidence',''))>4000 or length(coalesce(r->>'refundEvidence',''))>4000 then raise exception 'INVALID_ARCHIVE_ROW';end if;
  if nullif(trim(r->>'name'),'') is null and nullif(trim(r->>'phone'),'') is null then raise exception 'MISSING_SOURCE_IDENTITY';end if;
  n:=(r->>'people')::integer;t:=(r->>'total')::integer;applied:=(r->>'createdAt')::timestamptz;
  if n is not null and n not between 1 and 500 or t is not null and t not between 0 and 100000000 or applied is not null and applied>now()+interval '1 day' then raise exception 'INVALID_ARCHIVE_ROW';end if;
  if exists(select 1 from public.applications where legacy_key=r->>'sourceKey') then skipped:=skipped+1;continue;end if;
  insert into public.applications(created_at,original_session_id,session_id,name,address,phone,people,depositor,total,status,payment,refund,notice,policy_version,privacy_snapshot,refund_snapshot,source,legacy_key,legacy_response_modified,legacy_archive_data,legacy_imported_at)
  values(applied,s.id,s.id,nullif(trim(r->>'name'),''),nullif(trim(r->>'address'),''),nullif(trim(r->>'phone'),''),n,nullif(trim(r->>'depositor'),''),t,
   nullif(r->>'status',''),nullif(r->>'payment',''),nullif(r->>'refund',''),nullif(r->>'notice',''),0,coalesce(r->>'privacyEvidence',''),coalesce(r->>'refundEvidence',''),
   'naver_archive',r->>'sourceKey',coalesce((r->>'responseModified')::boolean,false),jsonb_build_object('originalRow',(r->>'originalRow')::integer)||(r->'original'),now());
  inserted:=inserted+1;
 end loop;
 return jsonb_build_object('inserted',inserted,'skipped',skipped);
end $$;
revoke all on function private.import_archive_records(jsonb) from public,anon,authenticated;
create or replace function public.import_archive_applications(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'FORBIDDEN';end if;
 return private.import_archive_records(payload);
end $$;
revoke all on function public.import_archive_applications(jsonb) from public,anon;
grant execute on function public.import_archive_applications(jsonb) to authenticated;
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
  update public.applications set payment='paid',refund=case when status='cancelled' and coalesce(refund,'none')='none' then 'pending' else refund end where id=a.id;
 when 'cancel' then
  if a.status is null or a.status not in ('active','cancelled') or exists(select 1 from public.sessions where id=a.session_id and completed) then raise exception 'INVALID_STATUS'; end if;
  update public.applications set status='cancelled',notice='needed',refund=case when payment='paid' and coalesce(refund,'none')='none' then 'pending' else refund end where id=a.id;
 when 'refund' then
  if a.status is distinct from 'cancelled' or a.payment is distinct from 'paid' or a.refund is distinct from 'pending' then raise exception 'INVALID_REFUND'; end if;
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


commit;
select '8단계 준비 완료' as result;

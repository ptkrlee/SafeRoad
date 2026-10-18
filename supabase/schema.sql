-- Run once in the Supabase SQL Editor on a NEW project. Do not rerun on live data.
begin;
create schema if not exists private;
revoke all on schema private from public;
create table private.admins (user_id uuid primary key references auth.users(id));
alter table private.admins enable row level security;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from private.admins where user_id=auth.uid())
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
create table public.settings (
 id integer primary key check(id=1), bank text not null, account text not null, holder text not null,
 fee integer not null check(fee>=0), privacy_text text not null default '', refund_text text not null default '',
 published boolean not null default false, version integer not null default 1
);
insert into public.settings(id,bank,account,holder,fee) values(1,'농협','301-0365-1653-61','부산치유협회',10000);
create table public.sessions (
 id uuid primary key default gen_random_uuid(), date date not null unique, start_time time,
 course text, capacity integer not null default 30 check(capacity between 1 and 500), minimum integer not null default 10,
 accepting boolean not null default false, cancelled boolean not null default false, notice_date date,
 check(minimum between 1 and capacity), check(notice_date is null or notice_date<=date)
);
insert into public.sessions(id,date,notice_date) values
 ('00000000-0000-4000-8000-000000000001','2026-10-23','2026-10-22'),
 ('00000000-0000-4000-8000-000000000002','2026-11-14','2026-11-13'),
 ('00000000-0000-4000-8000-000000000003','2026-11-21','2026-11-20');
create table public.applications (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 original_session_id uuid not null references public.sessions, session_id uuid not null references public.sessions,
 name text not null check(length(name) between 2 and 50), address text not null check(length(address) between 2 and 100),
 phone text not null check(phone ~ '^01[016789][0-9]{7,8}$'), people integer not null check(people between 1 and 30),
 depositor text not null check(length(depositor) between 2 and 50), total integer not null,
 status text not null default 'active' check(status in ('active','cancelled','attended','no_show')),
 payment text not null default 'unconfirmed' check(payment in ('unconfirmed','paid')),
 refund text not null default 'none' check(refund in ('none','pending','completed')),
 notice text not null default 'needed' check(notice in ('needed','contacted')),
 moved boolean not null default false, policy_version integer not null, privacy_snapshot text not null, refund_snapshot text not null
);
create table public.audit_log (
 id bigint generated always as identity primary key, created_at timestamptz not null default now(),
 actor uuid, entity text not null, entity_id text not null, operation text not null, detail jsonb not null
);
create function private.record_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Audit contains operational state only; no duplicated names, phones, addresses or consent text.
 if TG_TABLE_NAME='applications' then
  insert into public.audit_log(actor,entity,entity_id,operation,detail) values(auth.uid(),TG_TABLE_NAME,new.id::text,TG_OP,
    jsonb_build_object('session',new.session_id,'originalSession',new.original_session_id,'status',new.status,'payment',new.payment,'refund',new.refund,'notice',new.notice,'moved',new.moved,
      'before',case when TG_OP='UPDATE' then jsonb_build_object('session',old.session_id,'status',old.status,'payment',old.payment,'refund',old.refund,'notice',old.notice) else null end));
 else
  insert into public.audit_log(actor,entity,entity_id,operation,detail) values(auth.uid(),TG_TABLE_NAME,new.id::text,TG_OP,
    case when TG_TABLE_NAME='settings' then jsonb_build_object('version',to_jsonb(new)->'version','published',to_jsonb(new)->'published') else to_jsonb(new) end);
 end if;
 return new;
end $$;
create trigger application_audit after insert or update on public.applications for each row execute function private.record_change();
create trigger session_audit after update on public.sessions for each row execute function private.record_change();
create trigger settings_audit after update on public.settings for each row execute function private.record_change();
alter table public.settings enable row level security;
alter table public.sessions enable row level security;
alter table public.applications enable row level security;
alter table public.audit_log enable row level security;
create policy public_settings on public.settings for select to anon,authenticated using(true);
create policy public_sessions on public.sessions for select to anon,authenticated using(true);
create policy admin_applications on public.applications for select to authenticated using(public.is_admin());
create policy admin_audit on public.audit_log for select to authenticated using(public.is_admin());
revoke all on public.settings,public.sessions,public.applications,public.audit_log from anon,authenticated;
grant select on public.settings,public.sessions to anon,authenticated;
grant select on public.applications,public.audit_log to authenticated;
create function public.session_list() returns setof jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(s) || jsonb_build_object('booked',coalesce((select sum(a.people) from public.applications a where a.session_id=s.id and a.status in ('active','attended','no_show')),0)) from public.sessions s order by s.date
$$;
create function public.submit_application(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sessions; c public.settings; applicant public.applications; occupied integer;
begin
 select * into c from public.settings where id=1 for share;
 select * into s from public.sessions where id=(payload->>'sessionId')::uuid for update;
 if s.id is null or not c.published or not s.accepting or s.cancelled or s.date<(now() at time zone 'Asia/Seoul')::date then raise exception 'CLOSED'; end if;
 if payload->>'feeConsent' is distinct from 'true' or payload->>'refundConsent' is distinct from 'true' or payload->>'privacyConsent' is distinct from 'true' or payload->>'website' is distinct from '' or (payload->>'policyVersion')::integer is distinct from c.version then raise exception 'CONSENT'; end if;
 if (payload->>'people')::integer not between 1 and 30 then raise exception 'PEOPLE'; end if;
 select coalesce(sum(people),0) into occupied from public.applications where session_id=s.id and status in ('active','attended','no_show');
 if occupied+(payload->>'people')::integer>s.capacity then raise exception 'CAPACITY'; end if;
 if exists(select 1 from public.applications where session_id=s.id and phone=payload->>'phone' and name=trim(payload->>'name') and status='active') then raise exception 'DUPLICATE'; end if;
 insert into public.applications(original_session_id,session_id,name,address,phone,people,depositor,total,policy_version,privacy_snapshot,refund_snapshot)
 values(s.id,s.id,trim(payload->>'name'),trim(payload->>'address'),payload->>'phone',(payload->>'people')::integer,trim(payload->>'depositor'),c.fee*(payload->>'people')::integer,c.version,c.privacy_text,c.refund_text) returning * into applicant;
 return jsonb_build_object('id',applicant.id,'date',s.date,'people',applicant.people,'total',applicant.total,'bank',c.bank,'account',c.account,'holder',c.holder,'noticeDate',s.notice_date);
end $$;
create function public.save_settings(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if length(trim(payload->>'holder'))<1 or length(trim(payload->>'privacy_text'))<30 or length(trim(payload->>'refund_text'))<30 then raise exception 'POLICY_REQUIRED'; end if;
 update public.settings set holder=trim(payload->>'holder'),privacy_text=payload->>'privacy_text',refund_text=payload->>'refund_text',published=coalesce((payload->>'published')::boolean,false),version=version+1 where id=1;
end $$;
create function public.manage_session(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare s public.sessions; occupied integer;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 select * into s from public.sessions where id=(payload->>'id')::uuid for update;
 if s.id is null then raise exception 'NOT_FOUND'; end if;
 if payload->>'operation'='cancel' then
  update public.sessions set accepting=false,cancelled=true where id=s.id;
  update public.applications set status='cancelled',notice='needed',refund=case when payment='paid' then 'pending' else refund end where session_id=s.id and status='active';
 elsif payload->>'operation'='save' then
  select coalesce(sum(people),0) into occupied from public.applications where session_id=s.id and status in ('active','attended','no_show');
  if (payload->>'capacity')::integer<occupied then raise exception 'CAPACITY'; end if;
  if (payload->>'accepting')::boolean and (s.cancelled or s.date<(now() at time zone 'Asia/Seoul')::date or not exists(select 1 from public.settings where id=1 and published) or nullif(trim(payload->>'course'),'') is null or nullif(payload->>'start_time','') is null or nullif(payload->>'notice_date','') is null) then raise exception 'NOT_READY'; end if;
  if s.start_time is distinct from nullif(payload->>'start_time','')::time or s.course is distinct from nullif(trim(payload->>'course'),'') or s.notice_date is distinct from nullif(payload->>'notice_date','')::date then
   update public.applications set notice='needed' where session_id=s.id and status='active';
  end if;
  update public.sessions set start_time=nullif(payload->>'start_time','')::time,course=nullif(trim(payload->>'course'),''),notice_date=nullif(payload->>'notice_date','')::date,capacity=(payload->>'capacity')::integer,accepting=(payload->>'accepting')::boolean where id=s.id;
 else raise exception 'UNKNOWN_OPERATION'; end if;
end $$;
create function public.manage_application(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
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
 when 'move' then
  select * into target from public.sessions where id=(payload->>'target')::uuid;
  if target.id is null or target.id=a.session_id or not target.accepting or target.cancelled or target.date<(now() at time zone 'Asia/Seoul')::date or a.refund='completed' or a.status not in ('active','cancelled') then raise exception 'INVALID_MOVE'; end if;
  select coalesce(sum(people),0) into occupied from public.applications where session_id=target.id and status in ('active','attended','no_show');
  if occupied+a.people>target.capacity then raise exception 'CAPACITY'; end if;
  update public.applications set session_id=target.id,moved=true,status='active',refund='none',notice='needed' where id=a.id;
 else raise exception 'UNKNOWN_OPERATION'; end case;
end $$;
revoke all on function public.session_list(),public.submit_application(jsonb),public.save_settings(jsonb),public.manage_session(jsonb),public.manage_application(jsonb) from public;
grant execute on function public.session_list(),public.submit_application(jsonb) to anon,authenticated;
grant execute on function public.save_settings(jsonb),public.manage_session(jsonb),public.manage_application(jsonb) to authenticated;
commit;

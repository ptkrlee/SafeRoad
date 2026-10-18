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
alter table public.settings enable row level security;
alter table public.sessions enable row level security;
alter table public.applications enable row level security;
alter table public.audit_log enable row level security;
revoke all on public.settings,public.sessions,public.applications,public.audit_log from anon,authenticated;
commit;
select '1단계 완료' as result, count(*) as session_count from public.sessions;

-- Apply after 08. PIN hashes stay in private tables, never in roster exports or logs.
begin;
alter table public.settings add column if not exists application_edit_ready boolean not null default true;
alter table public.applications add column if not exists edit_version integer not null default 0;
alter table public.applications add column if not exists payment_review_required boolean not null default false;
create table if not exists private.application_edit_access(
 application_id uuid primary key references public.applications(id) on delete cascade,
 pin_hash text not null check(pin_hash ~ '^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$'),
 access_version uuid not null default gen_random_uuid()
);
create table if not exists private.application_edit_limits(key text primary key,started_at timestamptz not null default now(),attempts integer not null default 1);
alter table private.application_edit_access enable row level security;
alter table private.application_edit_limits enable row level security;
revoke all on private.application_edit_access,private.application_edit_limits from public,anon,authenticated,service_role;
create index if not exists application_edit_phone on public.applications(phone);
-- Retain all existing admission/consent checks, but create the PIN in the same transaction.
do $$begin
 if to_regprocedure('private.submit_application_before_pin(jsonb)') is null then
  alter function public.submit_application(jsonb) set schema private;
  alter function private.submit_application(jsonb) rename to submit_application_before_pin;
 end if;
end $$;
revoke all on function private.submit_application_before_pin(jsonb) from public,anon,authenticated,service_role;
create or replace function public.submit_application(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin raise exception 'FORM_UPDATE_REQUIRED';end $$;
revoke all on function public.submit_application(jsonb) from public,anon,authenticated,service_role;
create or replace function public.submit_application_with_access(payload jsonb,access_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt jsonb;
begin
 if access_hash is null or access_hash !~ '^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$' then raise exception 'INVALID_ACCESS';end if;
 receipt:=private.submit_application_before_pin(payload);
 insert into private.application_edit_access(application_id,pin_hash) values((receipt->>'id')::uuid,access_hash);
 return receipt;
end $$;
create or replace function public.application_edit_candidates(input_phone text) returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) from (
 select a.id,c.pin_hash,c.access_version from public.applications a join private.application_edit_access c on c.application_id=a.id
 where a.phone=input_phone order by a.created_at desc nulls last,a.id limit 50
 ) x;
$$;
create or replace function public.application_edit_limit(input_key text,max_attempts integer,clear_success boolean default false) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if input_key !~ '^[a-f0-9]{64}$' or max_attempts not between 1 and 40 then return false;end if;
 if clear_success then delete from private.application_edit_limits where key=input_key;return true;end if;
 delete from private.application_edit_limits where started_at<now()-interval '1 day';
 insert into private.application_edit_limits(key) values(input_key) on conflict(key) do update
 set attempts=case when private.application_edit_limits.started_at<now()-interval '15 minutes' then 1 else private.application_edit_limits.attempts+1 end,
 started_at=case when private.application_edit_limits.started_at<now()-interval '15 minutes' then now() else private.application_edit_limits.started_at end
 returning attempts into n;
 return n<=max_attempts;
end $$;
create or replace function public.application_edit_records(accesses jsonb) returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) from (
 select a.id,a.name,a.address,a.phone,a.people,a.depositor,a.total,a.status,a.payment,a.refund,a.edit_version,a.payment_review_required,
 s.date,s.course,s.start_time,c.fee,
 (a.status='active' and not s.completed and not s.cancelled and ((s.date+coalesce(s.start_time,'09:30'::time)) at time zone 'Asia/Seoul')>now()) as editable
 from jsonb_array_elements(accesses) e
 join private.application_edit_access k on k.application_id=(e->>'id')::uuid and k.access_version=(e->>'version')::uuid
 join public.applications a on a.id=k.application_id join public.sessions s on s.id=a.session_id cross join public.settings c where c.id=1
 ) x;
$$;
create or replace function private.edit_application_fields(payload jsonb,is_staff boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.applications;s public.sessions;c public.settings;n integer;occupied integer;changed_people boolean;new_total integer;unit_fee integer;
 new_name text:=nullif(trim(payload->>'name'),'');new_phone text:=nullif(trim(payload->>'phone'),'');new_address text:=nullif(trim(payload->>'address'),'');new_depositor text:=nullif(trim(payload->>'depositor'),'');
begin
 -- Follow the existing mutation lock order: settings, sessions, then application.
 select * into c from public.settings where id=1 for share;
 perform id from public.sessions order by id for update;
 select * into a from public.applications where id=(payload->>'id')::uuid for update;
 if a.id is null then raise exception 'NOT_FOUND';end if;
 if (payload->>'version')::integer is distinct from a.edit_version then raise exception 'STALE_EDIT';end if;
 select * into s from public.sessions where id=a.session_id;
 if not is_staff and (a.status is distinct from 'active' or s.completed or s.cancelled or ((s.date+coalesce(s.start_time,'09:30'::time)) at time zone 'Asia/Seoul')<=now()) then raise exception 'EDIT_CLOSED';end if;
 if coalesce(length(new_name),0)>1000 or coalesce(length(new_address),0)>2000 or coalesce(length(new_phone),0)>1000 or coalesce(length(new_depositor),0)>1000 then raise exception 'INVALID_FIELDS';end if;
 if new_phone is distinct from a.phone then new_phone:=nullif(regexp_replace(new_phone,'[\s-]','','g'),'');end if;
 if new_phone is distinct from a.phone and new_phone is not null and new_phone !~ '^01[016789][0-9]{7,8}$' then raise exception 'INVALID_PHONE';end if;
 n:=(payload->>'people')::integer;changed_people:=n is distinct from a.people;
 if n is not null and n not between 1 and (case when is_staff and a.source='naver_archive' then 500 else 30 end) then raise exception 'INVALID_PEOPLE';end if;
 if changed_people then
  if a.status='cancelled' or a.refund in ('pending','completed') then raise exception 'PEOPLE_LOCKED';end if;
  if payload->'amountConfirmed' is distinct from 'true'::jsonb then raise exception 'AMOUNT_CONFIRM';end if;
  if coalesce(n,0)>coalesce(a.people,0) and not s.completed and not s.cancelled and s.date>=(now() at time zone 'Asia/Seoul')::date and a.status in ('active','attended','no_show') then
   select coalesce(sum(people),0) into occupied from public.applications where session_id=s.id and id<>a.id and status in ('active','attended','no_show');
   if occupied+coalesce(n,0)>s.capacity or (not is_staff and n>a.people and not s.accepting) then raise exception 'CAPACITY';end if;
  end if;
 end if;
 if a.source<>'naver_archive' and (new_name is null or length(new_name) not between 2 and 50 or new_address is null or length(new_address) not between 2 and 100 or new_phone is null or new_phone !~ '^01[016789][0-9]{7,8}$' or new_depositor is null or length(new_depositor) not between 2 and 50 or n is null) then raise exception 'INVALID_FIELDS';end if;
 if (new_name is distinct from a.name or new_phone is distinct from a.phone) and exists(select 1 from public.applications x where x.id<>a.id and x.session_id=a.session_id and x.name=new_name and x.phone=new_phone and x.status='active') then raise exception 'DUPLICATE';end if;
 unit_fee:=case when a.people>0 and a.total is not null and a.total%a.people=0 then a.total/a.people else c.fee end;
 new_total:=case when changed_people then unit_fee*n else a.total end;
 update public.applications set name=new_name,address=new_address,phone=new_phone,people=n,depositor=new_depositor,total=new_total,
 payment=case when changed_people and a.payment='paid' then 'unconfirmed' else a.payment end,
 payment_review_required=case when changed_people and a.payment='paid' then true else a.payment_review_required end,
 notice=case when not s.completed then 'needed' else a.notice end,edit_version=edit_version+1 where id=a.id;
 insert into public.audit_log(actor,entity,entity_id,operation,detail) values(auth.uid(),'applications',a.id::text,case when is_staff then 'ADMIN_EDIT' else 'PARTICIPANT_EDIT' end,
 jsonb_build_object('before',jsonb_build_object('name',a.name,'address',a.address,'phone',a.phone,'people',a.people,'depositor',a.depositor,'total',a.total,'payment',a.payment),
 'after',jsonb_build_object('name',new_name,'address',new_address,'phone',new_phone,'people',n,'depositor',new_depositor,'total',new_total),'amountReview',changed_people and a.payment='paid'));
 return jsonb_build_object('ok',true,'total',new_total,'version',a.edit_version+1,'amountReview',changed_people and a.payment='paid');
end $$;
revoke all on function private.edit_application_fields(jsonb,boolean) from public,anon,authenticated,service_role;
create or replace function public.edit_application_admin(payload jsonb,new_access_hash text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN';end if;
 result:=private.edit_application_fields(payload,true);
 if new_access_hash is not null then
  if new_access_hash !~ '^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$' then raise exception 'INVALID_ACCESS';end if;
  insert into private.application_edit_access(application_id,pin_hash) values((payload->>'id')::uuid,new_access_hash)
  on conflict(application_id) do update set pin_hash=excluded.pin_hash,access_version=gen_random_uuid();
  insert into public.audit_log(actor,entity,entity_id,operation,detail) values(auth.uid(),'applications',payload->>'id','EDIT_PIN_RESET','{}'::jsonb);
 end if;
 return result;
end $$;
revoke all on function public.edit_application_admin(jsonb,text) from public,anon;
grant execute on function public.edit_application_admin(jsonb,text) to authenticated;
create or replace function public.edit_application_participant(payload jsonb,access_version uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform id from public.settings where id=1 for share;
 perform id from public.sessions order by id for update;
 perform 1 from private.application_edit_access k where k.application_id=(payload->>'id')::uuid and k.access_version=edit_application_participant.access_version for share;
 if not found then raise exception 'INVALID_ACCESS';end if;
 return private.edit_application_fields(payload,false);
end $$;
revoke all on function public.submit_application_with_access(jsonb,text),public.application_edit_candidates(text),public.application_edit_limit(text,integer,boolean),public.application_edit_records(jsonb),public.edit_application_participant(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.submit_application_with_access(jsonb,text),public.application_edit_candidates(text),public.application_edit_limit(text,integer,boolean),public.application_edit_records(jsonb),public.edit_application_participant(jsonb,uuid) to service_role;

-- Keep existing operations and clear the amount-review flag only after staff confirms payment.
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
  update public.applications set payment='paid',payment_review_required=false,refund=case when status='cancelled' and coalesce(refund,'none')='none' then 'pending' else refund end where id=a.id;
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

update public.settings set privacy_text=privacy_text||E'\n\n신청 변경용 비밀번호: 신청내역 확인·변경을 위해 단방향 해시로 변환한 인증값을 보관합니다. 비밀번호 원문은 저장하지 않으며 신청 기록의 보유 기간이 끝나면 함께 파기합니다.',version=version+1 where position('신청 변경용 비밀번호' in privacy_text)=0;

commit;
select '9단계 신청 수정 준비 완료' as result;

-- 관리자 전용 연락·특이사항 메모. 기존 신청·입금·연락 상태는 변경하지 않습니다.
-- 파일 전체를 한 번 실행합니다. 재실행해도 메모는 유지됩니다.
begin;
create table if not exists public.application_notes (
 id bigint generated always as identity primary key,
 request_id uuid not null unique,
 application_id uuid not null references public.applications(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default now(),
 actor uuid not null
);
create index if not exists application_notes_by_application on public.application_notes(application_id,id desc);
alter table public.application_notes enable row level security;
revoke all on public.application_notes from public,anon,authenticated;
grant select on public.application_notes to authenticated;
drop policy if exists admin_application_notes on public.application_notes;
create policy admin_application_notes on public.application_notes for select to authenticated using(public.is_admin());

create or replace function public.add_application_note(target uuid, note text, request_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.application_notes;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if target is null or request_key is null or note is null or length(btrim(note)) not between 1 and 1000 then raise exception 'INVALID_NOTE'; end if;
 insert into public.application_notes(request_id,application_id,body,actor)
 values(request_key,target,btrim(note),auth.uid()) on conflict(request_id) do nothing returning * into saved;
 if saved.id is null then
  select * into saved from public.application_notes where request_id=request_key;
  if saved.application_id<>target or saved.body<>btrim(note) or saved.actor<>auth.uid() then raise exception 'NOTE_CONFLICT'; end if;
 else
  insert into public.audit_log(actor,entity,entity_id,operation,detail)
  values(auth.uid(),'applications',target::text,'ADMIN_NOTE_ADDED',jsonb_build_object('note_id',saved.id));
 end if;
 return jsonb_build_object('id',saved.id,'body',saved.body,'created_at',saved.created_at);
end $$;
revoke all on function public.add_application_note(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.add_application_note(uuid,text,uuid) to authenticated;

create or replace function public.application_note_summaries(application_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if coalesce(cardinality(application_ids),0)>1000 then raise exception 'TOO_MANY_APPLICATIONS'; end if;
 select coalesce(jsonb_agg(summary),'[]'::jsonb) into result from (
  select application_id,count(*) as total,
   jsonb_agg(jsonb_build_object('id',id,'body',body,'created_at',created_at) order by id desc) filter(where rn<=5) as notes
  from (select n.*,row_number() over(partition by application_id order by id desc) as rn
   from public.application_notes n where application_id=any(application_ids)) ranked
  group by application_id
 ) summary;
 return result;
end $$;
revoke all on function public.application_note_summaries(uuid[]) from public,anon,authenticated;
grant execute on function public.application_note_summaries(uuid[]) to authenticated;
commit;
select '10단계 관리자 메모 준비 완료' as result;

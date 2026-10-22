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

-- Existing deployments: run AFTER the original schema / steps 01 and 02.
-- Additive migration. No existing applications or consent history is deleted.
begin;
alter table public.settings add column if not exists photo_text text not null default '';
alter table public.settings add column if not exists consent_revision integer not null default 1;
alter table public.applications add column if not exists photo_consent boolean;
alter table public.applications add column if not exists photo_policy_snapshot text;
alter table public.applications add column if not exists photo_consent_at timestamptz;
alter table public.applications add column if not exists source text not null default 'website';
alter table public.applications add column if not exists legacy_key text;
alter table public.applications add column if not exists legacy_response_modified boolean not null default false;
create unique index if not exists application_legacy_key on public.applications(legacy_key) where legacy_key is not null;
create or replace function private.record_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Audit contains operational state only; no duplicated names, phones, addresses or consent text.
 if TG_TABLE_NAME='applications' then
  insert into public.audit_log(actor,entity,entity_id,operation,detail) values(auth.uid(),TG_TABLE_NAME,new.id::text,TG_OP,
    jsonb_build_object('session',new.session_id,'originalSession',new.original_session_id,'status',new.status,'payment',new.payment,'refund',new.refund,'notice',new.notice,'moved',new.moved,'photoConsent',new.photo_consent,'source',new.source,
      'before',case when TG_OP='UPDATE' then jsonb_build_object('session',old.session_id,'status',old.status,'payment',old.payment,'refund',old.refund,'notice',old.notice) else null end));
 else
  insert into public.audit_log(actor,entity,entity_id,operation,detail) values(auth.uid(),TG_TABLE_NAME,new.id::text,TG_OP,
    case when TG_TABLE_NAME='settings' then jsonb_build_object('version',to_jsonb(new)->'version','published',to_jsonb(new)->'published') else to_jsonb(new) end);
 end if;
 return new;
end $$;

update public.settings set refund_text=$refund$1. 참가비와 입금
참가비는 1인 10,000원입니다. 신청 후 즉시 입금해주세요. 미입금자에게는 체험 전날 별도로 안내합니다. 입금 확인은 관리자가 직접 진행합니다.

2. 참가자 사정으로 취소하는 경우
환불 신청 마감은 체험 3일 전입니다. 010-9679-9817로 취소 문자를 남겨주세요. 마감 후 환불 가능 여부는 사무국으로 문의해주세요.
입금된 참가비에서 환불 이체수수료 500원을 제외하고 환불합니다. 농협 계좌로 환불하는 경우 이체수수료는 없습니다.

3. 주최 측이 취소하는 경우
우천 등 기상 악화, 인원 미달 등 주최 측 사정으로 프로그램을 취소하면 이체수수료 공제 없이 입금된 참가비 전액을 환불합니다.

4. 진행 여부 안내
체험 전 금요일에 기상 상황과 인원을 확인하고 진행 확정 여부를 문자로 안내합니다. 10월 23일 회차는 예외로 별도 안내일을 적용합니다. 정확한 안내일은 신청 완료 화면에서 확인해주세요. 금요일은 진행 여부 안내일이며, 이 문구가 별도의 취소·환불 마감일을 의미하지는 않습니다.

5. 취소·변경·문의
010-9679-9817로 신청자명과 신청 회차를 적어 문자를 남겨주세요. 접수된 순서대로 안내합니다. 환불 계좌는 환불 처리 시 사무국이 별도로 확인합니다. 날짜 변경은 대상 회차의 접수 상태와 정원에 따라 처리합니다.

6. 출발 전 확인
진행 안내를 받지 못했다면 출발 전에 사무국에 문의해주세요.$refund$, privacy_text=$privacy$개인정보 수집·이용 안내

1. 수집·이용 기관
부산치유협회

2. 수집·이용 목적
오륙도 안전걷기로드 체험프로그램의 참가 신청 처리, 참가자 관리, 입금 확인, 일정 변경·취소·환불 처리, 진행 및 취소 안내, 관련 문의 대응을 위해 이용합니다.

3. 수집 항목
신청자명 또는 신청단체명, 주소지(시·군·구), 휴대전화 번호, 참여 인원, 입금자명, 신청 회차, 신청 시각, 개인정보 동의 내역 및 신청·입금·변경·취소·환불·연락 처리 이력.
홈페이지 신청서에서는 주민등록번호, 상세주소, 환불 계좌를 수집하지 않습니다. 여행자보험에 별도 정보가 필요한 경우 수집 근거와 처리 방법을 안내한 후 별도로 진행하며, 이 동의만으로 주민등록번호 수집에 동의한 것으로 처리하지 않습니다. 사진 촬영·공유는 아래의 별도 선택 동의에 따릅니다.

4. 보유·이용 기간
신청일로부터 1년간 보관한 후 파기합니다.

5. 동의 거부 권리와 영향
개인정보 수집·이용에 동의하지 않을 수 있습니다. 다만 필수 정보 처리에 동의하지 않으면 홈페이지를 통한 체험 신청이 어렵습니다.

6. 문의
개인정보 관련 문의는 010-9679-9817로 문자를 남겨주세요. 순차적으로 안내합니다.$privacy$, photo_text=$photo$사진 촬영 및 초상 이용 동의 (선택)

1. 목적과 범위
체험 활동을 기록하고 참가자가 활동 사진을 확인할 수 있도록 본인의 사진·영상 촬영과 참가자 전용 비공개 온라인 카페 내 공유에 동의합니다. 공개 홈페이지·SNS·광고 등 공개 홍보 이용은 포함하지 않으며, 필요한 경우 별도로 동의를 받습니다. 실제 공유 카페와 열람 대상은 공유 전에 사무국이 별도로 안내합니다.

2. 처리 기관과 항목
부산치유협회가 처리하며, 촬영된 사진·영상에 포함된 본인의 얼굴·모습을 대상으로 합니다. 비공개 카페 공유 시 다른 참가자가 열람할 수 있습니다.

3. 보유 기간과 철회
신청일로부터 1년간 이용 후 파기합니다. 동의 철회·게시물 삭제 요청은 010-9679-9817로 문자 문의할 수 있습니다.

4. 선택 동의
동의하지 않아도 체험 신청과 참여에 불이익이 없습니다. 비동의자는 식별되는 촬영·게시 대상에서 제외합니다. 사무국은 촬영 전에 동의 여부를 확인합니다.

5. 일행의 동의
이 동의는 신청자 본인에게만 적용됩니다. 동반자와 단체 참가자의 동의를 대표자가 일괄 대신한 것으로 간주하지 않으며, 사무국이 필요한 경우 각 참가자의 동의를 별도로 확인합니다.

카페 등 공유처를 안내하고 동의 범위를 확인하기 전에는 사진을 게시하지 않습니다.$photo$, consent_revision=2,version=version+1 where id=1 and consent_revision<2;
create or replace function public.submit_application(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sessions; c public.settings; applicant public.applications; occupied integer;
begin
 select * into c from public.settings where id=1 for share;
 select * into s from public.sessions where id=(payload->>'sessionId')::uuid for update;
 if c.consent_revision<>2 or length(c.photo_text)<30 then raise exception 'MIGRATION_REQUIRED'; end if;
 if jsonb_typeof(payload->'photoConsent') is distinct from 'boolean' then raise exception 'PHOTO_CONSENT'; end if;
 if s.id is null or not c.published or not s.accepting or s.cancelled or s.date<(now() at time zone 'Asia/Seoul')::date then raise exception 'CLOSED'; end if;
 if payload->>'feeConsent' is distinct from 'true' or payload->>'refundConsent' is distinct from 'true' or payload->>'privacyConsent' is distinct from 'true' or payload->>'website' is distinct from '' or (payload->>'policyVersion')::integer is distinct from c.version then raise exception 'CONSENT'; end if;
 if (payload->>'people')::integer not between 1 and 30 then raise exception 'PEOPLE'; end if;
 select coalesce(sum(people),0) into occupied from public.applications where session_id=s.id and status in ('active','attended','no_show');
 if occupied+(payload->>'people')::integer>s.capacity then raise exception 'CAPACITY'; end if;
 if exists(select 1 from public.applications where session_id=s.id and phone=payload->>'phone' and name=trim(payload->>'name') and status='active') then raise exception 'DUPLICATE'; end if;
 insert into public.applications(original_session_id,session_id,name,address,phone,people,depositor,total,policy_version,privacy_snapshot,refund_snapshot,photo_consent,photo_policy_snapshot,photo_consent_at)
 values(s.id,s.id,trim(payload->>'name'),trim(payload->>'address'),payload->>'phone',(payload->>'people')::integer,trim(payload->>'depositor'),c.fee*(payload->>'people')::integer,c.version,c.privacy_text,c.refund_text,coalesce((payload->>'photoConsent')::boolean,false),c.photo_text,now()) returning * into applicant;
 return jsonb_build_object('id',applicant.id,'date',s.date,'people',applicant.people,'total',applicant.total,'bank',c.bank,'account',c.account,'holder',c.holder,'noticeDate',s.notice_date,'refundDeadline',s.date-3);
end $$;

create or replace function public.save_settings(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c public.settings; p text;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 select * into c from public.settings where id=1 for update;
 p:=coalesce(payload->>'photo_text',c.photo_text);
 if nullif(trim(payload->>'holder'),'') is null or coalesce(length(trim(payload->>'privacy_text')),0)<30 or coalesce(length(trim(payload->>'refund_text')),0)<30 or coalesce(length(trim(p)),0)<30 then raise exception 'POLICY_REQUIRED'; end if;
 update public.settings set holder=trim(payload->>'holder'),privacy_text=payload->>'privacy_text',refund_text=payload->>'refund_text',photo_text=p,published=coalesce((payload->>'published')::boolean,false),version=version+1,consent_revision=2 where id=1;
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
  if occupied+n>s.capacity then raise exception 'CAPACITY'; end if;
  insert into public.applications(created_at,original_session_id,session_id,name,address,phone,people,depositor,total,policy_version,privacy_snapshot,refund_snapshot,source,legacy_key,legacy_response_modified)
  values(original_time,s.id,s.id,trim(r->>'name'),trim(r->>'address'),r->>'phone',n,'원본 미기재',n*10000,0,
   '기존 네이버폼 개인정보 동의 응답: '||(r->>'privacyEvidence')||'. 원본의 응답일시와 수정 표시를 함께 보존합니다. 수정 표시가 있으면 최초 동의 시각을 확정한 것으로 보지 않습니다. 새 홈페이지 약관과 사진 동의로 간주하지 않습니다. 상세 원문은 원본 설문에서 확인합니다.',
   '기존 네이버폼 취소·환불 안내 확인 응답: '||coalesce(r->>'refundEvidence','원본 확인 필요')||'. 새 홈페이지 정책으로 대체하지 않습니다.',
   'naver',r->>'sourceKey',coalesce((r->>'responseModified')::boolean,false));
  inserted:=inserted+1;occupied:=occupied+n;
 end loop;
 return jsonb_build_object('inserted',inserted,'skipped',skipped);
end $$;
revoke all on function public.import_legacy_applications(jsonb) from public;
grant execute on function public.import_legacy_applications(jsonb) to authenticated;
revoke all on function public.submit_application(jsonb),public.save_settings(jsonb) from public;
grant execute on function public.submit_application(jsonb) to anon,authenticated;
grant execute on function public.save_settings(jsonb) to authenticated;
commit;
select '3단계 완료' as result;

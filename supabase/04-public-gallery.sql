-- Run after 03-consent-import.sql. Existing applications and their consent snapshots are preserved.
begin;
alter table public.applications add column if not exists participant_photo_consent boolean;
alter table public.applications add column if not exists participant_photo_policy_snapshot text;
alter table public.applications add column if not exists participant_photo_consent_at timestamptz;
update public.settings set refund_text=$refund$1. 참가비와 입금
참가비는 1인 10,000원입니다. 신청 후 즉시 입금해주세요. 미입금자에게는 체험 전날 별도로 안내합니다. 입금 확인은 관리자가 직접 진행합니다.

2. 참가자 사정으로 취소하는 경우
환불 신청 마감은 체험 3일 전 밤 11시 59분(한국시간)까지의 취소 문자 접수입니다. 예를 들어 11월 14일 체험은 11월 11일 밤 11시 59분까지입니다. 010-9679-9817로 취소 문자를 남겨주세요. 마감 후 환불 가능 여부는 사무국으로 문의해주세요.
입금된 참가비에서 환불 이체수수료 500원을 제외하고 환불합니다. 농협 계좌로 환불하는 경우 이체수수료는 없습니다.

3. 주최 측이 취소하는 경우
우천 등 기상 악화, 인원 미달 등 주최 측 사정으로 프로그램을 취소하면 이체수수료 공제 없이 입금된 참가비 전액을 환불합니다.

4. 진행 여부 안내
체험 전 금요일에 기상 상황과 인원을 확인하고 진행 확정 여부를 문자로 안내합니다. 10월 23일 회차는 예외로 별도 안내일을 적용합니다. 정확한 안내일은 신청 완료 화면에서 확인해주세요. 금요일은 진행 여부 안내일이며, 이 문구가 별도의 취소·환불 마감일을 의미하지는 않습니다.

5. 취소·변경·문의
010-9679-9817로 신청자명과 신청 회차를 적어 문자를 남겨주세요. 접수된 순서대로 안내합니다. 환불 계좌는 환불 처리 시 사무국이 별도로 확인합니다. 날짜 변경은 대상 회차의 접수 상태와 정원에 따라 처리합니다.

6. 출발 전 확인
진행 안내를 받지 못했다면 출발 전에 사무국에 문의해주세요.$refund$,photo_text=$photo$사진 촬영 및 게시 범위별 동의 (각각 선택)

1. 목적과 처리 기관
부산치유협회가 체험 활동을 기록하고 참가자가 사진을 확인·다운로드할 수 있도록 본인의 얼굴·모습이 포함된 사진을 촬영하고, 아래에서 동의한 공간에 게시합니다.

2. 완보자 사진방 게시·다운로드 (선택)
홈페이지의 완보자 사진방에 게시합니다. 현장에서 안내하는 8자리 체험 날짜코드(예: 20261114)로 입장한 사람이 해당 회차 사진을 열람·다운로드할 수 있습니다. 참가자 개별 인증을 하지 않으며, 날짜를 아는 외부인도 코드를 추측하여 입장할 수 있는 공유형 공간입니다. 사진을 다른 곳에 재게시하지 않도록 이용자에게 안내합니다.

3. 공식 공개 갤러리 게시·다운로드 (별도 선택)
홈페이지 공식 공개 갤러리에 게시합니다. 참가자뿐 아니라 홈페이지 방문자 누구나 열람·다운로드할 수 있습니다. 완보자 사진방에 동의했더라도 공식 공개 게시에는 따로 동의해야 합니다.

4. 보유 기간과 철회
신청일로부터 1년 이내에서 보관·이용한 후 파기합니다. 게시 중단·동의 철회·삭제 요청은 010-9679-9817로 문자 문의할 수 있습니다. 이미 제3자가 다운로드·복사한 외부 사본을 홈페이지에서 모두 회수할 수는 없습니다.

5. 동의 거부와 일행
두 항목 모두 선택이며 동의하지 않아도 신청·참여에 불이익이 없습니다. 동의는 신청자 본인에게만 적용됩니다. 동반자·단체 참가자의 동의를 대표자가 일괄 대신한 것으로 간주하지 않습니다. 관리자는 사진 속 식별 가능한 모든 인물의 해당 게시 범위 동의를 확인합니다.

6. 다른 매체 이용
SNS·광고 등 홈페이지 갤러리 밖의 다른 매체 이용은 포함하지 않으며 필요한 경우 별도 동의를 받습니다. 기존 카페·비공개 공유 동의를 새 홈페이지 게시 동의로 간주하지 않습니다.$photo$,consent_revision=4,version=version+1 where id=1 and consent_revision<4;
create or replace function public.submit_application(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sessions; c public.settings; applicant public.applications; occupied integer;
begin
 select * into c from public.settings where id=1 for share;
 select * into s from public.sessions where id=(payload->>'sessionId')::uuid for update;
 if (payload->>'formRevision')::integer is distinct from 4 then raise exception 'FORM_REVISION'; end if;
 if c.consent_revision<>4 or length(c.photo_text)<30 then raise exception 'MIGRATION_REQUIRED'; end if;
 if jsonb_typeof(payload->'privatePhotoConsent') is distinct from 'boolean' or jsonb_typeof(payload->'photoConsent') is distinct from 'boolean' then raise exception 'PHOTO_CONSENT'; end if;
 if s.id is null or not c.published or not s.accepting or s.cancelled or s.date<(now() at time zone 'Asia/Seoul')::date then raise exception 'CLOSED'; end if;
 if payload->>'feeConsent' is distinct from 'true' or payload->>'refundConsent' is distinct from 'true' or payload->>'privacyConsent' is distinct from 'true' or payload->>'website' is distinct from '' or (payload->>'policyVersion')::integer is distinct from c.version then raise exception 'CONSENT'; end if;
 if (payload->>'people')::integer not between 1 and 30 then raise exception 'PEOPLE'; end if;
 select coalesce(sum(people),0) into occupied from public.applications where session_id=s.id and status in ('active','attended','no_show');
 if occupied+(payload->>'people')::integer>s.capacity then raise exception 'CAPACITY'; end if;
 if exists(select 1 from public.applications where session_id=s.id and phone=payload->>'phone' and name=trim(payload->>'name') and status='active') then raise exception 'DUPLICATE'; end if;
 insert into public.applications(original_session_id,session_id,name,address,phone,people,depositor,total,policy_version,privacy_snapshot,refund_snapshot,photo_consent,photo_policy_snapshot,photo_consent_at,participant_photo_consent,participant_photo_policy_snapshot,participant_photo_consent_at)
 values(s.id,s.id,trim(payload->>'name'),trim(payload->>'address'),payload->>'phone',(payload->>'people')::integer,trim(payload->>'depositor'),c.fee*(payload->>'people')::integer,c.version,c.privacy_text,c.refund_text,coalesce((payload->>'photoConsent')::boolean,false),c.photo_text,now(),(payload->>'privatePhotoConsent')::boolean,c.photo_text,now()) returning * into applicant;
 return jsonb_build_object('id',applicant.id,'date',s.date,'people',applicant.people,'total',applicant.total,'bank',c.bank,'account',c.account,'holder',c.holder,'noticeDate',s.notice_date,'refundDeadline',s.date-3);
end $$;

create or replace function public.save_settings(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c public.settings; p text;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 select * into c from public.settings where id=1 for update;
 p:=coalesce(payload->>'photo_text',c.photo_text);
 if nullif(trim(payload->>'holder'),'') is null or coalesce(length(trim(payload->>'privacy_text')),0)<30 or coalesce(length(trim(payload->>'refund_text')),0)<30 or coalesce(length(trim(p)),0)<30 then raise exception 'POLICY_REQUIRED'; end if;
 update public.settings set holder=trim(payload->>'holder'),privacy_text=payload->>'privacy_text',refund_text=payload->>'refund_text',photo_text=p,published=coalesce((payload->>'published')::boolean,false),version=version+1,consent_revision=4 where id=1;
end $$;

create table if not exists public.gallery_photos (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.sessions,
 object_path text not null unique, preview_path text not null unique, caption text not null default '' check(length(caption)<=200),
 visibility text not null default 'participants' check(visibility in ('public','participants')),
 published boolean not null default false, expires_at timestamptz not null,
 created_at timestamptz not null default now(), consent_confirmed_at timestamptz,
 check(not published or consent_confirmed_at is not null)
);
alter table public.gallery_photos enable row level security;
revoke all on public.gallery_photos from anon,authenticated;
grant select on public.gallery_photos to anon,authenticated,service_role;
grant select on public.sessions to service_role;
drop policy if exists saferoad_public_gallery on public.gallery_photos;
create policy saferoad_public_gallery on public.gallery_photos for select to anon,authenticated using(published and visibility='public' and expires_at>now());
drop policy if exists saferoad_admin_gallery on public.gallery_photos;
create policy saferoad_admin_gallery on public.gallery_photos for select to authenticated using(public.is_admin());
create index if not exists gallery_session_created on public.gallery_photos(session_id,created_at desc);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('saferoad-gallery','saferoad-gallery',false,10485760,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists saferoad_gallery_public_read on storage.objects;
create policy saferoad_gallery_public_read on storage.objects for select to anon,authenticated using(
 bucket_id='saferoad-gallery' and exists(select 1 from public.gallery_photos p where (p.object_path=storage.objects.name or p.preview_path=storage.objects.name) and p.published and p.visibility='public' and p.expires_at>now())
);
drop policy if exists saferoad_gallery_admin_read on storage.objects;
create policy saferoad_gallery_admin_read on storage.objects for select to authenticated using(bucket_id='saferoad-gallery' and public.is_admin());
drop policy if exists saferoad_gallery_admin_insert on storage.objects;
create policy saferoad_gallery_admin_insert on storage.objects for insert to authenticated with check(
 bucket_id='saferoad-gallery' and public.is_admin() and exists(select 1 from public.gallery_photos p where (p.object_path=storage.objects.name or p.preview_path=storage.objects.name) and not p.published)
);
drop policy if exists saferoad_gallery_admin_delete on storage.objects;
create policy saferoad_gallery_admin_delete on storage.objects for delete to authenticated using(bucket_id='saferoad-gallery' and public.is_admin());
create or replace function public.prepare_gallery_photo(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid; pid uuid:=gen_random_uuid(); expires timestamptz; path text; preview text;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if coalesce(payload->>'visibility','participants') not in ('public','participants') then raise exception 'INVALID_VISIBILITY'; end if;
 if coalesce(payload->>'extension','') not in ('jpg','png','webp') or length(coalesce(payload->>'caption',''))>200 then raise exception 'INVALID_PHOTO'; end if;
 sid:=(payload->>'sessionId')::uuid;
 if not exists(select 1 from public.sessions where id=sid) then raise exception 'INVALID_SESSION'; end if;
 select least(now()+interval '1 year',coalesce(min(created_at+interval '1 year'),now()+interval '1 year')) into expires from public.applications where session_id=sid;
 if expires<=now() then raise exception 'EXPIRED_CONSENT_WINDOW'; end if;
 path:=sid::text||'/'||pid::text||'.'||(payload->>'extension');preview:=sid::text||'/'||pid::text||'-preview.jpg';
 insert into public.gallery_photos(id,session_id,object_path,preview_path,visibility,caption,expires_at) values(pid,sid,path,preview,coalesce(payload->>'visibility','participants'),coalesce(trim(payload->>'caption'),''),expires);
 insert into public.audit_log(actor,entity,entity_id,operation,detail) values(auth.uid(),'gallery_photos',pid::text,'PREPARE',jsonb_build_object('session',sid,'visibility',coalesce(payload->>'visibility','participants'),'expiresAt',expires));
 return jsonb_build_object('id',pid,'object_path',path,'preview_path',preview);
end $$;
create or replace function public.manage_gallery_photo(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare p public.gallery_photos;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 select * into p from public.gallery_photos where id=(payload->>'id')::uuid for update;
 if p.id is null then raise exception 'NOT_FOUND'; end if;
 case payload->>'operation'
 when 'publish' then
  if payload->'scopeConsentConfirmed' is distinct from 'true'::jsonb then raise exception 'PUBLIC_CONSENT_REQUIRED'; end if;
  if p.expires_at<=now() or not exists(select 1 from storage.objects where bucket_id='saferoad-gallery' and name=p.object_path) or not exists(select 1 from storage.objects where bucket_id='saferoad-gallery' and name=p.preview_path) then raise exception 'MISSING_OR_EXPIRED_PHOTO'; end if;
  update public.gallery_photos set published=true,consent_confirmed_at=now() where id=p.id;
 when 'hide' then update public.gallery_photos set published=false where id=p.id;
 when 'delete' then
  if exists(select 1 from storage.objects where bucket_id='saferoad-gallery' and name in (p.object_path,p.preview_path)) then raise exception 'REMOVE_FILE_FIRST'; end if;
  delete from public.gallery_photos where id=p.id;
 else raise exception 'UNKNOWN_OPERATION'; end case;
 insert into public.audit_log(actor,entity,entity_id,operation,detail) values(auth.uid(),'gallery_photos',p.id::text,upper(payload->>'operation'),jsonb_build_object('session',p.session_id,'visibility',p.visibility,'scopeConsentConfirmed',payload->>'scopeConsentConfirmed','expiresAt',p.expires_at));
end $$;
revoke all on function public.prepare_gallery_photo(jsonb),public.manage_gallery_photo(jsonb) from public;
grant execute on function public.prepare_gallery_photo(jsonb),public.manage_gallery_photo(jsonb) to authenticated;
revoke all on function public.submit_application(jsonb),public.save_settings(jsonb) from public;
grant execute on function public.submit_application(jsonb) to anon,authenticated;
grant execute on function public.save_settings(jsonb) to authenticated;
commit;
select '4단계 완료' as result;

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {photoPolicy,refundPolicy,privacyPolicy} from '../lib/policies';
import {matchesImage,signedPhotoLifetime} from '../lib/gallery';
const SID='00000000-0000-4000-8000-000000000002',ADMIN='10000000-0000-4000-8000-000000000001',OTHER='10000000-0000-4000-8000-000000000002';
test('사진 형식과 만료시간을 확인한다',()=>{
 assert.equal(matchesImage(new Uint8Array([255,216,255]),'jpg'),true);assert.equal(matchesImage(new Uint8Array([137,80,78,71,13,10,26,10]),'png'),true);assert.equal(matchesImage(new TextEncoder().encode('RIFFxxxxWEBP'),'webp'),true);assert.equal(matchesImage(new TextEncoder().encode('<svg>'),'png'),false);assert.equal(matchesImage(new Uint8Array([]),'jpg'),false);
 const now=Date.now();assert.equal(signedPhotoLifetime(new Date(now+120000).toISOString(),now),60);assert.equal(signedPhotoLifetime(new Date(now+5000).toISOString(),now),5);assert.equal(signedPhotoLifetime(new Date(now-1000).toISOString(),now),0);
});
test('공개 갤러리: 기존 비공개 동의 보존·관리자 업로드·공개 승인·숨김·만료·삭제 권한',async(t)=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated,service_role;grant select,insert,delete on storage.objects to anon,authenticated;grant select on storage.objects to service_role;`);
  for(const file of ['schema.sql','03-consent-import.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${ADMIN}'),('${OTHER}');insert into private.admins values('${ADMIN}');
   insert into public.applications(original_session_id,session_id,name,address,phone,people,depositor,total,policy_version,privacy_snapshot,refund_snapshot,photo_consent,photo_policy_snapshot)
   select '${SID}','${SID}','기존범위동의가상','부산 남구','01000000001',1,'가상입금자',10000,version,privacy_text,refund_text,true,photo_text from public.settings where id=1;`);
  const old=(await db.query<any>('select photo_policy_snapshot from public.applications')).rows[0].photo_policy_snapshot;
  const migration=await readFile(new URL('../supabase/04-public-gallery.sql',import.meta.url),'utf8');await db.exec(migration);const viewOnlyMigration=await readFile(new URL('../supabase/05-public-gallery-view-only.sql',import.meta.url),'utf8');await db.exec(viewOnlyMigration);
  async function role(user:string|null){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec(user?'set role authenticated':'set role anon');}
  async function rpc(name:string,payload:object){return(await db.query<{result:any}>(`select public.${name}($1::jsonb) as result`,[JSON.stringify(payload)])).rows[0].result;}
  let photo:{id:string;object_path:string;preview_path:string};
  await t.test('새 공개 범위로 기존 동의를 소급 변경하지 않으며 정책 버전과 동의문을 갱신한다',async()=>{
   const settings=(await db.query<any>('select * from public.settings')).rows[0];assert.equal(settings.consent_revision,4);assert.equal(settings.photo_text,photoPolicy);assert.equal(settings.refund_text,refundPolicy);assert.match(settings.refund_text,/11시 59분/);
   assert.equal((await db.query<any>('select photo_policy_snapshot from public.applications')).rows[0].photo_policy_snapshot,old);assert.notEqual(old,photoPolicy);
  });
  await t.test('익명·비관리자 업로드와 게시를 차단하고 준비 사진은 공개하지 않는다',async()=>{
   await role(null);await assert.rejects(()=>rpc('prepare_gallery_photo',{sessionId:SID,extension:'jpg',visibility:'public',caption:''}),/permission denied/);
   await role(OTHER);await assert.rejects(()=>rpc('prepare_gallery_photo',{sessionId:SID,extension:'jpg',visibility:'public',caption:''}),/FORBIDDEN/);
   await role(ADMIN);photo=await rpc('prepare_gallery_photo',{sessionId:SID,extension:'jpg',visibility:'public',caption:'가상 체험 사진'});
   await assert.rejects(()=>rpc('manage_gallery_photo',{id:photo.id,operation:'publish',scopeConsentConfirmed:true}),/MISSING_OR_EXPIRED_PHOTO/);
   await db.query("insert into storage.objects(bucket_id,name) values('saferoad-gallery',$1),('saferoad-gallery',$2)",[photo.object_path,photo.preview_path]);
   await role(null);assert.equal((await db.query('select * from public.gallery_photos')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
   await assert.rejects(()=>db.query("insert into storage.objects(bucket_id,name) values('saferoad-gallery','forged.jpg')"),/row-level security/);
  });
  await t.test('공개 게시 동의 확인 후에만 사진과 파일을 방문자에게 공개한다',async()=>{
   await role(ADMIN);await assert.rejects(()=>rpc('manage_gallery_photo',{id:photo.id,operation:'publish'}),/PUBLIC_CONSENT_REQUIRED/);await assert.rejects(()=>rpc('manage_gallery_photo',{id:photo.id,operation:'publish',scopeConsentConfirmed:'true'}),/PUBLIC_CONSENT_REQUIRED/);
   await rpc('manage_gallery_photo',{id:photo.id,operation:'publish',scopeConsentConfirmed:true});
   await role(null);assert.equal((await db.query('select * from public.gallery_photos')).rows.length,1);assert.equal((await db.query('select * from storage.objects')).rows.length,1);assert.equal((await db.query('select * from storage.objects where name=$1',[photo.object_path])).rows.length,0);assert.equal((await db.query('select * from storage.objects where name=$1',[photo.preview_path])).rows.length,1);
   await assert.rejects(()=>db.query('update public.gallery_photos set published=false'),/permission denied/);
   await role(OTHER);await assert.rejects(()=>rpc('manage_gallery_photo',{id:photo.id,operation:'hide'}),/FORBIDDEN/);
   await role(ADMIN);await rpc('manage_gallery_photo',{id:photo.id,operation:'hide'});await role(null);assert.equal((await db.query('select * from public.gallery_photos')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  });
  await t.test('공개 기한 종료 시 파일 접근을 차단하고 파일을 지운 뒤 기록을 삭제한다',async()=>{
   await role(ADMIN);await rpc('manage_gallery_photo',{id:photo.id,operation:'publish',scopeConsentConfirmed:true});
   await db.exec('reset role');await db.query("update public.gallery_photos set expires_at=now()-interval '1 second' where id=$1",[photo.id]);
   await role(null);assert.equal((await db.query('select * from public.gallery_photos')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
   await role(ADMIN);await assert.rejects(()=>rpc('manage_gallery_photo',{id:photo.id,operation:'publish',scopeConsentConfirmed:true}),/MISSING_OR_EXPIRED_PHOTO/);await assert.rejects(()=>rpc('manage_gallery_photo',{id:photo.id,operation:'delete'}),/REMOVE_FILE_FIRST/);
   await db.query('delete from storage.objects where name in ($1,$2)',[photo.object_path,photo.preview_path]);await rpc('manage_gallery_photo',{id:photo.id,operation:'delete'});assert.equal((await db.query('select * from public.gallery_photos')).rows.length,0);
   const log=(await db.query<any>("select * from public.audit_log where entity='gallery_photos' order by id")).rows;assert.ok(log.some(l=>l.operation==='PUBLISH'&&l.detail.scopeConsentConfirmed==='true'));assert.equal(log.at(-1).operation,'DELETE');
  });

  await t.test('완보자 사진은 익명·일반 로그인 사용자가 파일 경로를 알아도 직접 읽을 수 없다',async()=>{
   await role(ADMIN);const privatePhoto=await rpc('prepare_gallery_photo',{sessionId:SID,extension:'jpg',visibility:'participants',caption:'완보자 사진'});
   await db.query("insert into storage.objects(bucket_id,name) values('saferoad-gallery',$1),('saferoad-gallery',$2)",[privatePhoto.object_path,privatePhoto.preview_path]);
   await rpc('manage_gallery_photo',{id:privatePhoto.id,operation:'publish',scopeConsentConfirmed:true});
   for(const user of [null,OTHER]){await role(user);assert.equal((await db.query('select * from public.gallery_photos where id=$1',[privatePhoto.id])).rows.length,0);assert.equal((await db.query('select * from storage.objects where name=$1',[privatePhoto.object_path])).rows.length,0);}
   await db.exec('reset role');await db.exec('set role service_role');assert.equal((await db.query('select * from public.gallery_photos where id=$1',[privatePhoto.id])).rows.length,1);
   await role(ADMIN);
  });
  await t.test('새 신청은 공개 동의문을 기록하고 예전 화면의 제출은 거부한다',async()=>{
   await rpc('save_settings',{holder:'부산치유협회',privacy_text:privacyPolicy,refund_text:refundPolicy,photo_text:photoPolicy,published:true});assert.equal((await db.query<any>('select consent_revision from public.settings')).rows[0].consent_revision,4);
   await rpc('manage_session',{id:SID,operation:'save',accepting:true,capacity:30,start_time:'09:30',course:'남파랑길',notice_date:'2026-11-13'});
   const version=(await db.query<any>('select version from public.settings')).rows[0].version;
   const payload={sessionId:SID,name:'새공개동의가상',address:'부산 남구',phone:'01000000002',people:1,depositor:'가상입금자',feeConsent:true,refundConsent:true,privacyConsent:true,photoConsent:true,privatePhotoConsent:false,website:'',policyVersion:version};
   await role(null);await assert.rejects(()=>rpc('submit_application',payload),/FORM_REVISION/);const added=await rpc('submit_application',{...payload,formRevision:4});
   await role(ADMIN);const row=(await db.query<any>('select * from public.applications where id=$1',[added.id])).rows[0];assert.equal(row.photo_policy_snapshot,photoPolicy);assert.equal(row.photo_consent,true);assert.equal(row.participant_photo_consent,false);assert.equal(row.participant_photo_policy_snapshot,photoPolicy);
   const before=(await db.query<any>('select version from public.settings')).rows[0].version;await db.exec('reset role');await db.exec(migration);await db.exec(viewOnlyMigration);assert.equal((await db.query<any>('select version from public.settings')).rows[0].version,before);assert.equal((await db.query<any>('select photo_policy_snapshot from public.applications where id=$1',[row.id])).rows[0].photo_policy_snapshot,photoPolicy);
  });
 }finally{await db.close();}
});

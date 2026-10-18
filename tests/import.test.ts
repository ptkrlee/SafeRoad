import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseLegacyRows} from '../lib/legacy-import';
import {refundDeadline,applicationSchema} from '../lib/domain';
const hash=async(s:string)=>createHash('sha256').update(s).digest('hex');
const headers=['응답일시','참여자','신청자명(*)','주소지(*)','참여인원(*)','참가비','신청자 연락처(*)','취소·환불 정책(*)','개인정보 수집 및 이용 동의(*)'];
const row=['2026-10-17 10:30:00 (수정)','응답자','가상참가자','부산 남구','2','네, 확인했습니다.','01000000000','네, 확인했습니다.','Y'];
test('네이버폼 수정 응답일시와 동의를 보존하고 중복·비동의·수식을 걸러낸다',async()=>{
 const r=await parseLegacyRows([headers,row],'2026-11-14',hash);
 assert.equal(r.rows.length,1);assert.deepEqual(r.issues,[]);assert.equal(r.rows[0].people,2);
 assert.equal(r.rows[0].responseModified,true);assert.equal(r.rows[0].createdAt,'2026-10-17T10:30:00+09:00');assert.equal(r.rows[0].privacyEvidence,'Y');
 const duplicates=await parseLegacyRows([headers,row,row],'2026-11-14',hash);assert.equal(duplicates.rows.length,1);assert.equal(duplicates.duplicates,1);assert.equal(duplicates.issues.length,1);
 const no=[...row];no[8]='N';assert.equal((await parseLegacyRows([headers,no],'2026-11-14',hash)).rows.length,0);
 const formula=[...row];formula[2]='=SOMEFORMULA()';assert.equal((await parseLegacyRows([headers,formula],'2026-11-14',hash)).rows.length,0);
 const other=await parseLegacyRows([headers,row],'2026-11-21',hash);assert.notEqual(other.rows[0].sourceKey,r.rows[0].sourceKey);
});
test('3일 전 날짜 계산은 월·연도를 넘어도 한국 달력 날짜를 유지한다',()=>{
 assert.equal(refundDeadline('2026-11-14'),'2026-11-11');assert.equal(refundDeadline('2026-11-21'),'2026-11-18');assert.equal(refundDeadline('2026-10-23'),'2026-10-20');assert.equal(refundDeadline('2027-01-02'),'2026-12-30');
});
test('사진 비동의는 허용하고 응답 필드 없는 구버전 신청은 거부한다',()=>{
 const valid={sessionId:'00000000-0000-4000-8000-000000000001',name:'가상참가자',address:'부산 남구',phone:'01000000000',people:1,depositor:'가상입금자',feeConsent:true,refundConsent:true,privacyConsent:true,photoConsent:false,privatePhotoConsent:false,formRevision:4};
 assert.equal(applicationSchema.safeParse({...valid,photoConsent:undefined}).success,false);assert.equal(applicationSchema.parse({...valid,photoConsent:false}).photoConsent,false);assert.equal(applicationSchema.parse({...valid,photoConsent:true}).photoConsent,true);assert.equal(applicationSchema.safeParse({...valid,photoConsent:'true'}).success,false);
});

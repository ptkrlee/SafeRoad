import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationSchema, canApply, formatDate, initialSessions, initialSettings } from '../lib/domain';
test('최신 일정과 금요일 예외 안내일을 유지한다',()=>{
 assert.deepEqual(initialSessions.map(s=>[s.date,s.notice_date]),[['2026-10-23','2026-10-22'],['2026-11-14','2026-11-13'],['2026-11-21','2026-11-20']]);
 assert.match(formatDate('2026-10-23'),/금/);
});
test('연결 전·정책 미승인·마감·운영 취소·정원 초과·지난 회차는 신청할 수 없다',()=>{
 const session={...initialSessions[0],accepting:true};const settings={...initialSettings,published:true};
 assert.equal(canApply(session,settings,'2026-10-18'),true);
 assert.equal(canApply(session,initialSettings,'2026-10-18'),false);
 for(const patch of [{accepting:false},{cancelled:true},{booked:30},{date:'2026-10-17'}]) assert.equal(canApply({...session,...patch},settings,'2026-10-18'),false);
});
test('일행 포함 인원·연락처·동의와 봇 필드를 검증한다',()=>{
 const input={sessionId:initialSessions[0].id,name:'가상참가자',address:'부산 남구',phone:'010-1234-5678',people:'2',depositor:'가상입금자',feeConsent:true,refundConsent:true,privacyConsent:true,website:''};
 assert.equal(applicationSchema.parse(input).phone,'01012345678');
 assert.equal(applicationSchema.parse(input).people,2);
 for(const patch of [{people:0},{people:31},{people:1.5},{phone:'123'},{privacyConsent:false},{refundConsent:false},{website:'spam'}])assert.equal(applicationSchema.safeParse({...input,...patch}).success,false);
});

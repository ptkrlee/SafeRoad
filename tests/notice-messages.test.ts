import test from 'node:test';
import assert from 'node:assert/strict';
import {initialSessions,initialSettings} from '../lib/domain';
import {buildNoticeMessage,changeOptions,noticeRecipients,type NoticeRecipient} from '../lib/notice-messages';
const sessions=initialSessions.map(s=>({...s,accepting:true}));const settings={...initialSettings,published:true};
test('진행 안내는 회차의 실제 날짜·요일·코스·집결과 종료 시간을 채운다',()=>{
 const text=buildNoticeMessage({kind:'confirmed',session:sessions[0],settings});
 assert.match(text,/2026년 10월 23일 \(금\)/);assert.match(text,/오전 9시 30분까지 집결/);assert.match(text,/낮 12시 30분~오후 1시경/);assert.match(text,/해파랑길/);assert.match(text,/무릎 위/);assert.doesNotMatch(text,/10\. 02|한국치유협회 부산지회/);
});
test('취소 안내의 변경 후보는 과거·취소·마감·정원 초과 회차를 제외하며 전액 환불을 안내한다',()=>{
 const rounds=[...sessions,{...sessions[2],id:'full',booked:30},{...sessions[2],id:'closed',accepting:false},{...sessions[2],id:'cancelled',cancelled:true},{...sessions[2],id:'past',date:'2026-10-01'}];
 const options=changeOptions(rounds,settings,sessions[0].id,'2026-10-19');assert.deepEqual(options.map(s=>s.id),[sessions[1].id,sessions[2].id]);
 const text=buildNoticeMessage({kind:'cancelled',session:sessions[0],settings,alternatives:options,reason:'신청 인원 미달'});assert.match(text,/11월 14일 \(토\)/);assert.match(text,/11월 21일 \(토\)/);assert.match(text,/이체수수료 공제 없이 전액 환불/);assert.doesNotMatch(text,/현재 잔여|잔여 정원/);assert.doesNotMatch(text,/전화 연결/);assert.doesNotMatch(text,/10월 18일/);
 const empty=buildNoticeMessage({kind:'cancelled',session:sessions[0],settings,missedCall:true});assert.match(empty,/현재 안내 가능한 변경 회차가 없어/);assert.match(empty,/전화 연결/);assert.doesNotMatch(empty,/1\. 일정 변경/);
});
test('미입금 안내는 최신 계좌를 사용하고 별도 기한과 전화 부재를 임의로 만들지 않는다',()=>{
 const input={kind:'unpaid' as const,session:sessions[1],settings:{...settings,fee:12000,bank:'가상은행',account:'TEST-ACCOUNT',holder:'가상예금주'}};
 const basic=buildNoticeMessage(input);assert.match(basic,/12,000원/);assert.match(basic,/가상은행 TEST-ACCOUNT/);assert.match(basic,/예금주: 가상예금주/);assert.match(basic,/신청서에 적으신 입금자명/);assert.doesNotMatch(basic,/마감일|5\/29|입금 요청 기한|자동.*취소/);
 const deadline=buildNoticeMessage({...input,deadlineDate:'2026-11-13',deadlineTime:'14:00'});assert.match(deadline,/2026년 11월 13일 \(금\) 오후 2시까지/);
});
test('안내 대상은 최초 회차가 아닌 현재 회차로 분류하고 미입금 취소자는 제외한다',()=>{
 const base:NoticeRecipient={id:'moved',session_id:sessions[1].id,original_session_id:sessions[0].id,name:'가상 신청자',phone:'01000000001',people:2,status:'active',payment:'unconfirmed',refund:'none',notice:'needed',moved:true};
 const apps=[base,{...base,id:'paid',payment:'paid'},{...base,id:'cancelled',status:'cancelled'},{...base,id:'left',session_id:sessions[2].id}];
 assert.deepEqual(noticeRecipients(apps,sessions[1].id,'unpaid').map(a=>a.id),['moved']);assert.deepEqual(noticeRecipients(apps,sessions[1].id,'confirmed').map(a=>a.id),['moved','paid']);assert.deepEqual(noticeRecipients(apps,sessions[1].id,'cancelled').map(a=>a.id),['moved','paid','cancelled']);assert.equal(noticeRecipients(apps,sessions[0].id,'cancelled').length,0);
});

test('취소 안내는 요청한 양식으로 생성하고 날짜와 변경 코스만 실제 회차로 채운다',()=>{
 const text=buildNoticeMessage({kind:'cancelled',session:sessions[0],settings,alternatives:[sessions[1]]});
 assert.equal(text,`[안내] 10월 23일 (금) 오륙도 안전걷기체험 취소 및 후속 안내

안녕하세요. 사단법인 부산치유협회입니다.

신청해주신 2026년 10월 23일 (금) 체험프로그램이 부득이한 사정에 따라 취소되었습니다.
기대하셨을 텐데 불편을 드려 진심으로 죄송합니다.

■ 선택 사항
1. 일정 변경: 11월 14일 (토) · 남파랑길 1코스
2. 전액 환불

변경 또는 환불 의사를 문자로 회신 부탁드리며, 금번 취소 건은 주최 측 취소로, 입금하신 참가비는 이체수수료 공제 없이 전액 환불해드립니다.

다시 한번 죄송한 말씀을 드립니다.

문의·취소·변경: 010-9679-9817
문자를 남겨주시면 순차적으로 안내해드리겠습니다.
감사합니다.`);
});

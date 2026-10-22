import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseArchiveSheets} from '../lib/archive-import';
const hash=async(v:string)=>createHash('sha256').update(v).digest('hex');
test('historical manual sheets preserve every applicant, duplicate identities and missing fields',async()=>{
 const sheets=[{sheet:'운영명단',data:[['참여자','신청자명(*)','참여인원','연락처','출석체크','입금확인'],[1,'가상 신청자',2,'01000000001','불참','O'],[2,'가상 신청자',null,null,'취소',null],[3,'동반자 가, 동반자 나',2,null,null,'1P'],[null,'전체신청인원',4,null,'실제참여인원',0],[null,'취소인원',1],[null,'불참인원',2]]}];
 const result=await parseArchiveSheets(sheets,'2026-04-25',hash);assert.deepEqual(result.issues,[]);assert.equal(result.rows.length,3);assert.equal(result.summaryRows,3);assert.equal(result.rows[0].status,'no_show');assert.equal(result.rows[0].payment,'paid');assert.equal(result.rows[1].status,'cancelled');assert.equal(result.rows[1].people,null);assert.equal(result.rows[1].phone,null);assert.equal(result.rows[1].createdAt,null);assert.equal(result.rows[1].depositor,null);assert.equal(result.rows[1].total,null);assert.equal(result.rows[2].payment,null);assert.notEqual(result.rows[0].sourceKey,result.rows[1].sourceKey);
 assert.deepEqual((await parseArchiveSheets(sheets,'2026-04-25',hash)).rows,result.rows);
});
test('summary labels and policy text are not mistaken for cancelled applicants; ambiguous refund notes stay in the source',async()=>{
 const result=await parseArchiveSheets([{sheet:'원본',data:[['응답일시','신청자명','참여인원','연락처','취소·환불 정책','개인정보','입금(5/6)','5/8이후'],['2026-04-23 17:29:04','가상 신청자',4,0.1000000001,'취소·환불 안내 확인','Y',4,'환불(5/10)'],[null,'신청자소계',4],[null,'중복/취소',1],[null,'총계',3]]}],'2026-05-09',hash);
 assert.equal(result.rows.length,1);assert.equal(result.summaryRows,3);assert.equal(result.rows[0].status,null);assert.equal(result.rows[0].refund,null);assert.equal(result.rows[0].original.cells[7],'환불(5/10)');assert.equal(result.rows[0].phone,'01000000001');assert.equal(result.rows[0].createdAt,'2026-04-23T17:29:04+09:00');
});

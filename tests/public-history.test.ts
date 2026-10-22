import test from 'node:test';
import assert from 'node:assert/strict';
import {completedHistory,confirmedHistory} from '../lib/confirmed-history';
import {initialSessions} from '../lib/domain';
test('public first five completed rounds remain visible without historical DB rows',()=>{
 for(const sessions of [[],initialSessions])assert.deepEqual(completedHistory(sessions),confirmedHistory);
});
test('database completed rounds merge by date and do not count upcoming or cancelled rounds',()=>{
 const history=completedHistory([
  {...initialSessions[0],date:'2026-04-25',completed:true,course:'기존 운영 코스'},
  {...initialSessions[0],date:'2026-10-18',completed:true},
  {...initialSessions[1],completed:false},
  {...initialSessions[2],completed:true,cancelled:true},
 ]);
 assert.equal(history.length,6);assert.equal(history.find(s=>s.date==='2026-04-25')?.course,'기존 운영 코스');assert(history.some(s=>s.date==='2026-10-18'));assert(!history.some(s=>s.date==='2026-11-14'||s.date==='2026-11-21'));
});

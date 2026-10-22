import test from 'node:test';
import assert from 'node:assert/strict';
import {bulkEligible,type BulkApplication} from '../lib/bulk-applications';
const base:BulkApplication={id:'test',session_id:'round',people:2,status:'active',payment:'unconfirmed',notice:'needed'};
test('bulk cancellation skips completed, attended, cancelled and absent records',()=>{
 assert.equal(bulkEligible(base,'cancel',new Set()),true);
 assert.equal(bulkEligible(base,'cancel',new Set(['round'])),false);
 for(const status of ['cancelled','attended','no_show'])assert.equal(bulkEligible({...base,status},'cancel',new Set()),false);
});
test('bulk payment and contact skip processed records and allow late payment recording for cancelled applications',()=>{
 assert.equal(bulkEligible({...base,payment:'paid'},'paid',new Set()),false);
 assert.equal(bulkEligible({...base,status:'cancelled'},'paid',new Set()),true);
 assert.equal(bulkEligible({...base,notice:'contacted'},'contacted',new Set()),false);
 assert.equal(bulkEligible(base,'contacted',new Set()),true);
});

import {performBulkApplications} from '../lib/bulk-application-operation';
const id1='00000000-0000-4000-8000-000000000001';const id2='00000000-0000-4000-8000-000000000002';const id3='00000000-0000-4000-8000-000000000003';
function bulkStub({admin=true,user=true,failId='',throwId=''}={}){
 const calls:string[]=[];const db={auth:{getUser:async()=>({data:{user:user?{id:'admin'}:null}})},rpc:async(name:string,args?:{payload:{id:string}})=>{if(name==='is_admin')return{data:admin,error:null};if(name==='session_list')return{data:[],error:null};const id=args!.payload.id;calls.push(id);if(id===throwId)throw Error('disconnected');return{error:id===failId?{message:'failure'}:null};},from:()=>{const q={select:()=>q,in:async()=>({data:[{...base,id:id1},{...base,id:id2,payment:'paid'},{...base,id:id3}],error:null})};return q;}};
 return{db:db as unknown as Parameters<typeof performBulkApplications>[0],calls};
}
test('bulk actions require administrator authentication and explicit cancellation confirmation',async()=>{
 for(const options of [{user:false},{admin:false}]){const{db,calls}=bulkStub(options);const result=await performBulkApplications(db,{ids:[id1],operation:'paid',confirmed:false});assert(result.error);assert.deepEqual(calls,[]);}
 const {db,calls}=bulkStub();assert((await performBulkApplications(db,{ids:[id1],operation:'cancel',confirmed:false})).error);assert.deepEqual(calls,[]);
});
test('bulk result distinguishes success, already processed and failures and deduplicates selected ids',async()=>{
 const{db,calls}=bulkStub({failId:id3});const result=await performBulkApplications(db,{ids:[id1,id1,id2,id3],operation:'paid',confirmed:false});assert.deepEqual(result.processed,[id1]);assert.deepEqual(result.skipped,[id2]);assert.deepEqual(result.failed,[id3]);assert.deepEqual(calls,[id1,id3]);
});
test('interrupted bulk processing preserves confirmed progress and reports uncertainty',async()=>{
 const {db}=bulkStub({throwId:id3});const result=await performBulkApplications(db,{ids:[id1,id3],operation:'paid',confirmed:false});assert.deepEqual(result.processed,[id1]);assert(result.error);assert.deepEqual(result.failed,[]);
});

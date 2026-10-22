import test from 'node:test';
import assert from 'node:assert/strict';
import {rosterFilters,rosterPath,rosterReturnPath,queryRoster} from '../lib/admin-application-filters';
import {initialSessions} from '../lib/domain';
const current=initialSessions[0];const finished={...initialSessions[1],completed:true};
type Row={id:string;session_id:string;name:string;status:string;payment:string;refund:string;notice:string;created_at:string};
const row=(id:string,change:Partial<Row>={}):Row=>({id,session_id:current.id,name:'가상 참가자',status:'active',payment:'unconfirmed',refund:'none',notice:'needed',created_at:'2026-10-20T00:00:00Z',...change});
function stub(rows:Row[]){
 const matches:((r:Row)=>boolean)[]=[];const sorts:{column:keyof Row;ascending:boolean}[]=[];
 const builder={select:()=>builder,is:(key:keyof Row,_value:null)=>{matches.push(r=>r[key]===null);return builder;},or:(_value:string)=>{matches.push(r=>r.status==='active'||r.status===null);return builder;},eq:(key:keyof Row,value:string)=>{matches.push(r=>r[key]===value);return builder;},in:(key:keyof Row,values:string[])=>{matches.push(r=>values.includes(r[key]));return builder;},not:(key:keyof Row,_operator:string,value:string)=>{const values=value.slice(1,-1).split(',');matches.push(r=>!values.includes(r[key]));return builder;},order:(column:keyof Row,options:{ascending:boolean})=>{sorts.push({column,ascending:options.ascending});return builder;},limit:async(n:number)=>{const result=rows.filter(r=>matches.every(match=>match(r))).sort((a,b)=>{for(const{column,ascending}of sorts){const order=a[column].localeCompare(b[column]);if(order)return ascending?order:-order;}return 0;});return{data:result.slice(0,n),count:result.length,error:null};}};
 return {from:()=>builder} as unknown as Parameters<typeof queryRoster>[0];
}
test('combined filters operate on all records before the display limit',async()=>{
 const rows=[...Array.from({length:1001},(_,i)=>row(String(i),{payment:'paid'})),row('target')];
 const result=await queryRoster(stub(rows),rosterFilters({session:current.id,status:'active',payment:'unconfirmed',notice:'needed'}),[current,finished]);
 assert.deepEqual(result.data?.map(r=>r.id),['target']);assert.equal(result.count,1);
});
test('participation scheduled and completed attendance unknown are distinct filters',async()=>{
 const rows=[row('scheduled'),row('unknown',{session_id:finished.id}),row('attended',{session_id:finished.id,status:'attended'}),row('cancelled',{status:'cancelled'})];
 for(const [status,ids]of [['active',['scheduled']],['attendance_unknown',['unknown']],['attended',['attended']],['cancelled',['cancelled']]]as const){const result=await queryRoster(stub(rows),rosterFilters({status}),[current,finished]);assert.deepEqual(result.data?.map(r=>r.id),ids);}
 assert.equal((await queryRoster(stub(rows),rosterFilters({status:'attendance_unknown'}),[current])).count,0);
});
test('payment, contact, refund and alphabetical sort priorities are stable',async()=>{
 const rows=[row('a',{name:'가상 가',payment:'paid',notice:'contacted'}),row('b',{name:'가상 나',refund:'pending'})];
 for(const [sort,first]of [['name','a'],['name_desc','b'],['unpaid','b'],['contact','b'],['refund','b']]as const){const result=await queryRoster(stub(rows),rosterFilters({sort}),[current]);assert.equal(result.data?.[0].id,first);}
});
test('invalid conditions are ignored and post-action return paths preserve only safe roster filters',()=>{
 assert.equal(rosterFilters({payment:'unknown',sort:['name']}).payment,'');assert.equal(rosterFilters({sort:'bad'}).sort,'newest');
 const filters=rosterFilters({session:current.id,payment:'unconfirmed',notice:'needed',sort:'oldest'});const path=rosterPath(filters);assert.equal(rosterReturnPath(path),path);
 for(const raw of ['https://evil.invalid/admin','//evil.invalid/admin','/gallery','javascript:alert(1)'])assert.equal(rosterReturnPath(raw),'/admin');
 assert(!rosterReturnPath('/admin?payment=paid&untrusted=value').includes('untrusted'));
});

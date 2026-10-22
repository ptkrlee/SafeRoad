import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {applicationExportResponse} from '../lib/application-export-response';
import {initialSessions} from '../lib/domain';
const session={...initialSessions[0],completed:true};
const row={id:'00000000-0000-4000-8000-000000000099',original_session_id:session.id,name:'=HYPERLINK("https://example.invalid")',phone:'01000000001',address:'가상 지역',people:2,depositor:'테스트',total:20000,status:'active',payment:'unconfirmed',refund:'none',notice:'needed',created_at:'2026-10-20T01:00:00Z',source:'naver',moved:false};
function stub({user=true,admin=true,count=1,fail=false}={}){
 const reads:{field:string;value:string;start:number;end:number}[]=[];
 const db={auth:{getUser:async()=>({data:{user:user?{id:'admin'}:null}})},rpc:async(name:string)=>({data:name==='is_admin'?admin:[session],error:null}),from:()=>{let field='';let value='';const q={select:()=>q,eq:(f:string,v:string)=>{field=f;value=v;return q;},order:()=>q,range:async(start:number,end:number)=>{reads.push({field,value,start,end});return{data:fail?null:Array.from({length:Math.max(0,Math.min(count-start,end-start+1))},(_,i)=>({...row,id:`row-${start+i}`})),error:fail?{message:'internal detail must not escape'}:null};}};return q;}};
 return{db:db as unknown as Parameters<typeof applicationExportResponse>[1],reads};
}
const request=()=>new Request(`https://example.test/admin/export?session=${session.id}`);
test('roster export denies anonymous and non-admin requests before reading personal records',async()=>{
 for(const options of [{user:false},{admin:false}]){const {db,reads}=stub(options);const response=await applicationExportResponse(request(),db);assert.equal(response.status,options.user===false?401:403);assert.equal(reads.length,0);assert.match(response.headers.get('cache-control')||'',/no-store/);}
});
test('XLSX export is scoped to the selected round, includes over 1000 records and keeps text as text',async()=>{
 const {db,reads}=stub({count:1001});const response=await applicationExportResponse(request(),db);assert.equal(response.status,200);assert.equal(reads.length,2);assert(reads.every(r=>r.field==='session_id'&&r.value===session.id));
 const book=new ExcelJS.Workbook();await book.xlsx.load(await response.arrayBuffer());const sheet=book.getWorksheet('신청자 명단')!;assert.equal(sheet.rowCount,1002);assert.equal(sheet.getCell('D2').value,row.name);assert.equal(sheet.getCell('D2').type,ExcelJS.ValueType.String);assert.equal(sheet.getCell('E2').value,'01000000001');assert.equal(sheet.getCell('J2').value,'운영 종료 · 참석 미확인');assert.match(response.headers.get('content-disposition')||'',/attachment/);assert.match(response.headers.get('cache-control')||'',/no-store/);
});
test('failed export returns an error instead of an incomplete spreadsheet',async()=>{const {db}=stub({fail:true});const response=await applicationExportResponse(request(),db);assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/internal detail/);});

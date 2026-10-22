import test from 'node:test';
import assert from 'node:assert/strict';
import {bulkGalleryOperation} from '../lib/gallery-management';
import {adminGalleryPreview} from '../lib/admin-gallery-preview';
import {formatGalleryDate} from '../lib/domain';
const ids=[1,2,3].map(n=>`00000000-0000-4000-8000-00000000000${n}`);
function stub({user=true,admin=true,failRemove='',failDelete='',bytes=new Uint8Array([255,216,255,1]),missing=false}={}){
 const rows=new Map(ids.map((id,i)=>[id,{object_path:`${i}.jpg`,preview_path:`${i}-preview.jpg`,published:i!==1}]));const calls:string[]=[];let selected='';
 const db={auth:{getUser:async()=>({data:{user:user?{id:'admin'}:null},error:null})},rpc:async(name:string,{payload}:any={})=>{if(name==='is_admin')return{data:admin,error:null};calls.push(`${payload.operation}:${payload.id}`);const photo=rows.get(payload.id)!;if(payload.operation==='hide')photo.published=false;if(payload.operation==='delete'){if(payload.id===failDelete)return{error:{message:'internal detail'}};rows.delete(payload.id);}return{error:null};},from:()=>{calls.push('read');const q={select:()=>q,eq:(_k:string,id:string)=>{selected=id;return q;},single:async()=>({data:missing?null:rows.get(selected),error:null})};return q;},storage:{from:()=>({remove:async(paths:string[])=>{calls.push('remove:'+selected);return{error:selected===failRemove?{message:'internal detail'}:null};},download:async(path:string)=>{calls.push('download:'+path);return{data:new Blob([bytes]),error:null};}})}};
 return{db:db as unknown as Parameters<typeof bulkGalleryOperation>[1],rows,calls};
}
test('gallery batch denies anonymous/non-admin and unconfirmed or invalid deletes before any write',async()=>{
 for(const options of [{user:false},{admin:false}]){const{db,calls}=stub(options);const r=await bulkGalleryOperation({ids,operation:'hide'},db);assert(r.error);assert.deepEqual(calls,[]);}
 for(const input of [{ids,operation:'delete',confirmed:false},{ids:['invalid'],operation:'hide'},{ids,operation:'publish'},{ids:Array(11).fill(ids[0]),operation:'hide'}]){const{db,calls}=stub();assert((await bulkGalleryOperation(input,db)).error);assert.deepEqual(calls,[]);}
});
test('gallery batch hides each selected photo once and skips already private photos',async()=>{
 const{db,rows,calls}=stub();const result=await bulkGalleryOperation({ids:[...ids,ids[0]],operation:'hide'},db);assert.deepEqual(result.processed,[ids[0],ids[2]]);assert.deepEqual(result.skipped,[ids[1]]);assert.equal(result.failed.length,0);assert([...rows.values()].every(p=>!p.published));assert.equal(calls.filter(c=>c===`hide:${ids[0]}`).length,1);assert(!calls.some(c=>c.startsWith('remove:')));
});
test('failed file deletion stays hidden and retryable while other selected photos finish',async()=>{
 const{db,rows,calls}=stub({failRemove:ids[0]});const result=await bulkGalleryOperation({ids,operation:'delete',confirmed:true},db);assert.deepEqual(result.processed,[ids[1],ids[2]]);assert.equal(result.failed[0].id,ids[0]);assert.equal(rows.size,1);assert.equal(rows.get(ids[0])!.published,false);assert(!calls.includes(`delete:${ids[0]}`));assert(calls.indexOf(`hide:${ids[2]}`)<calls.indexOf(`remove:${ids[2]}`));assert(calls.indexOf(`remove:${ids[2]}`)<calls.indexOf(`delete:${ids[2]}`));assert(!JSON.stringify(result).includes('internal detail'));
 const retry=await bulkGalleryOperation({ids:[ids[0]],operation:'delete',confirmed:true},db);assert.equal(retry.failed.length,1);assert.equal(rows.size,1);
});
test('failed record cleanup reports failure after file removal instead of false success',async()=>{
 const{db,rows}=stub({failDelete:ids[0]});const result=await bulkGalleryOperation({ids:[ids[0]],operation:'delete',confirmed:true},db);assert.equal(result.processed.length,0);assert.match(result.failed[0].error,/목록 정리/);assert.equal(rows.get(ids[0])!.published,false);
});
test('admin previews require authentication and admin role before accessing any photo',async()=>{
 for(const [options,status]of [[{user:false},401],[{admin:false},403]] as const){const{db,calls}=stub(options);const response=await adminGalleryPreview(ids[0],db);assert.equal(response.status,status);assert.deepEqual(calls,[]);assert.match(response.headers.get('cache-control')!,/private.*no-store/);}
});
test('admin previews serve only thumbnail JPEG bytes, including hidden photos; corrupt/missing/oversized previews fail closed',async()=>{
 const{db,calls}=stub();const response=await adminGalleryPreview(ids[1],db);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');assert(calls.includes('download:1-preview.jpg'));assert(!calls.includes('download:1.jpg'));assert.match(response.headers.get('cache-control')!,/no-store/);
 for(const options of [{bytes:new TextEncoder().encode('<svg>')},{bytes:new Uint8Array(1024*1024+1)}])assert.equal((await adminGalleryPreview(ids[0],stub(options).db)).status,422);
 assert.equal((await adminGalleryPreview(ids[0],stub({missing:true}).db)).status,404);assert.equal((await adminGalleryPreview('invalid',stub().db)).status,404);
});
test('gallery dates spell all seven weekdays in full',()=>{
 ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'].forEach((day,i)=>assert(formatGalleryDate(`2026-10-${String(18+i).padStart(2,'0')}`).endsWith(day)));
 assert.equal(formatGalleryDate('2026-09-19'),'9월 19일 토요일');assert.equal(formatGalleryDate('2026-09-19',true),'2026년 9월 19일 토요일');
});

import {z} from 'zod';
import type {database} from './supabase';
import {galleryBucket} from './gallery';
type AdminDatabase=Awaited<ReturnType<typeof database>>;
export type GalleryOperation='hide'|'delete';
export type GalleryChange={ok?:boolean;skipped?:boolean;error?:string};
export type GalleryBatchResult={processed:string[];skipped:string[];failed:{id:string;error:string}[];error?:string};

/** Called with the signed-in administrator's database, retaining storage RLS and audit RPCs. */
export async function changeGalleryPhoto(db:AdminDatabase,id:string,operation:GalleryOperation):Promise<GalleryChange>{
 try{
  const{data:photo,error:find}=await db.from('gallery_photos').select('object_path,preview_path,published').eq('id',id).single();
  if(find||!photo)return{error:'사진을 찾지 못했습니다. 목록을 새로고침해주세요.'};
  if(operation==='hide'&&!photo.published)return{skipped:true};
  // Hide before removing either file. A partial failure leaves a hidden, retryable record.
  const{error:hide}=await db.rpc('manage_gallery_photo',{payload:{id,operation:'hide'}});
  if(hide)return{error:'비공개 처리에 실패했습니다.'};
  if(operation==='delete'){
   const{error:remove}=await db.storage.from(galleryBucket).remove([photo.object_path,photo.preview_path]);
   if(remove)return{error:'비공개 처리됐지만 파일 삭제에 실패했습니다. 다시 삭제해주세요.'};
   const{error:finish}=await db.rpc('manage_gallery_photo',{payload:{id,operation:'delete'}});
   if(finish)return{error:'파일은 삭제됐지만 목록 정리에 실패했습니다. 다시 삭제해주세요.'};
  }
  return{ok:true};
 }catch{return{error:'처리 결과를 확인하지 못했습니다. 사진 상태를 확인한 뒤 다시 시도해주세요.'};}
}
const batchSchema=z.object({ids:z.array(z.string().uuid()).min(1).max(10),operation:z.enum(['hide','delete']),confirmed:z.boolean().optional()});
export async function bulkGalleryOperation(input:unknown,db:AdminDatabase):Promise<GalleryBatchResult>{
 const result:GalleryBatchResult={processed:[],skipped:[],failed:[]};
 const parsed=batchSchema.safeParse(input);
 if(!parsed.success)return{...result,error:'한 번에 10장 이하의 사진과 처리 종류를 확인해주세요.'};
 if(parsed.data.operation==='delete'&&parsed.data.confirmed!==true)return{...result,error:'선택 사진의 영구 삭제 확인란을 체크해주세요.'};
 try{
  const{data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)return{...result,error:'관리자 로그인을 확인해주세요.'};
  const{data:admin,error:adminError}=await db.rpc('is_admin');
  if(adminError||admin!==true)return{...result,error:'관리자 권한을 확인해주세요.'};
 }catch{return{...result,error:'관리자 로그인과 연결 상태를 확인해주세요.'};}
 for(const id of new Set(parsed.data.ids)){
  const changed=await changeGalleryPhoto(db,id,parsed.data.operation);
  if(changed.ok)result.processed.push(id);
  else if(changed.skipped)result.skipped.push(id);
  else result.failed.push({id,error:changed.error||'처리하지 못했습니다.'});
 }
 return result;
}

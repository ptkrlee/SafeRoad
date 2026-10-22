'use server';
import {bulkGalleryOperation,changeGalleryPhoto,type GalleryBatchResult} from '@/lib/gallery-management';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {database} from '@/lib/supabase';
import {galleryBucket,matchesImage,maxPhotoSize} from '@/lib/gallery';
import {participantGalleryConfigured} from '@/lib/participant-gallery-server';
async function adminDatabase(){const db=await database();const{data:{user}}=await db.auth.getUser();const{data:admin}=await db.rpc('is_admin');if(!user||!admin)throw new Error('UNAUTHORIZED');return db;}
export async function preparePhoto(input:unknown):Promise<{error?:string;photo?:{id:string;object_path:string;preview_path:string}}>{
 const parsed=z.object({sessionId:z.string().uuid(),extension:z.enum(['jpg','png','webp']),visibility:z.enum(['public','participants']),caption:z.string().trim().max(200)}).safeParse(input);if(!parsed.success)return {error:'사진 정보를 확인해주세요.'};
 if(parsed.data.visibility==='participants'&&!participantGalleryConfigured())return{error:'완보자 사진방의 서버 연결 설정이 필요합니다.'};
 try{const db=await adminDatabase();const{data,error}=await db.rpc('prepare_gallery_photo',{payload:parsed.data});if(error)return {error:'사진 준비에 실패했습니다. 추가 SQL과 사진 보유 기간을 확인해주세요.'};return{photo:data};}catch{return{error:'관리자 로그인과 연결 상태를 확인해주세요.'};}
}
export async function publishPhoto(id:string,confirmed:boolean){
 if(!z.string().uuid().safeParse(id).success||confirmed!==true)return{error:'사진 속 모든 식별 가능한 인물의 선택한 게시 범위와 다운로드 동의를 확인해주세요.'};
 try{const db=await adminDatabase();const{data:photo,error:find}=await db.from('gallery_photos').select('*').eq('id',id).single();if(find||!photo)return{error:'사진을 찾지 못했습니다.'};
 const{data:file,error:download}=await db.storage.from(galleryBucket).download(photo.object_path);
 if(download||!file||file.size>maxPhotoSize||!matchesImage(new Uint8Array(await file.slice(0,12).arrayBuffer()),photo.object_path.split('.').at(-1)!))return{error:'업로드한 사진 형식을 확인하지 못했습니다. JPEG·PNG·WebP 사진을 사용해주세요.'};
 const{data:preview,error:previewError}=await db.storage.from(galleryBucket).download(photo.preview_path);if(previewError||!preview||preview.size>1024*1024||!matchesImage(new Uint8Array(await preview.slice(0,12).arrayBuffer()),'jpg'))return{error:'미리보기 사진 형식을 확인하지 못했습니다. 사진을 다시 업로드해주세요.'};
 const{error}=await db.rpc('manage_gallery_photo',{payload:{id,operation:'publish',scopeConsentConfirmed:true}});if(error)return{error:'게시하지 못했습니다. 추가 설정과 사진 공개 기한을 확인해주세요.'};revalidatePath('/gallery');revalidatePath('/admin');return{ok:true};
 }catch{return{error:'게시 결과를 확인하지 못했습니다. 관리자 화면을 새로고침해 상태를 확인해주세요.'};}
}
function refreshGallery(){revalidatePath('/gallery');revalidatePath('/gallery/participants');revalidatePath('/admin');}
export async function changePhoto(id:string,operation:'hide'|'delete'){
 if(!z.string().uuid().safeParse(id).success||!['hide','delete'].includes(operation))return{error:'요청을 확인해주세요.'};
 try{const db=await adminDatabase();const result=await changeGalleryPhoto(db,id,operation);refreshGallery();return result;}
 catch{return{error:'관리자 로그인과 연결 상태를 확인해주세요.'};}
}
export async function bulkChangePhotos(input:unknown):Promise<GalleryBatchResult>{
 try{const result=await bulkGalleryOperation(input,await database());refreshGallery();return result;}
 catch{return{processed:[],skipped:[],failed:[],error:'관리자 로그인과 연결 상태를 확인해주세요.'};}
}

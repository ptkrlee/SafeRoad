import {z} from 'zod';
import type {database} from './supabase';
import {galleryBucket,matchesImage} from './gallery';
/** Preview bytes stay behind admin authentication, including hidden or expired photos. */
export async function adminGalleryPreview(id:string,db:Awaited<ReturnType<typeof database>>){
 const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
 const error=(status:number)=>new Response('사진 미리보기를 불러올 수 없습니다.',{status,headers});
 if(!z.string().uuid().safeParse(id).success)return error(404);
 try{
  const{data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return error(401);
  const{data:admin,error:adminError}=await db.rpc('is_admin');if(adminError||admin!==true)return error(403);
  const{data:photo,error:find}=await db.from('gallery_photos').select('preview_path').eq('id',id).single();if(find||!photo)return error(404);
  const{data:file,error:download}=await db.storage.from(galleryBucket).download(photo.preview_path);
  if(download||!file)return error(404);
  if(file.size>1024*1024)return error(422);
  const bytes=new Uint8Array(await file.arrayBuffer());if(!matchesImage(bytes,'jpg'))return error(422);
  return new Response(bytes,{headers:{...headers,'Content-Type':'image/jpeg','Content-Length':String(bytes.length)}});
 }catch{return error(503);}
}

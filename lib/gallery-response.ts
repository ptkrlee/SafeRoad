import {NextResponse} from 'next/server';
import {z} from 'zod';
import {configured,database} from '@/lib/supabase';
import {galleryBucket,signedPhotoLifetime} from '@/lib/gallery';
import {participantGalleryAccess,participantGalleryDatabase} from '@/lib/participant-gallery-server';
export async function galleryResponse(id:string,download:boolean){
 const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex'};
 if(!z.string().uuid().safeParse(id).success)return new NextResponse('사진을 찾을 수 없습니다.',{status:404,headers});
 if(!configured())return new NextResponse('갤러리 준비 중입니다.',{status:503,headers});
 try{let db=await database();const{data:found}=await db.from('gallery_photos').select('object_path,preview_path,expires_at,visibility,session_id').eq('id',id).eq('published',true).gt('expires_at',new Date().toISOString()).single();
 let p=found;
 if(p?.visibility==='participants'){const{data:admin}=await db.rpc('is_admin');if(!admin)p=null;}
 if(!p){const access=await participantGalleryAccess();if(access){db=participantGalleryDatabase();const{data:privatePhoto}=await db.from('gallery_photos').select('object_path,preview_path,expires_at,visibility,session_id').eq('id',id).eq('session_id',access.sessionId).eq('visibility','participants').eq('published',true).gt('expires_at',new Date().toISOString()).single();p=privatePhoto;}}
 if(!p)return new NextResponse('공개 중인 사진을 찾을 수 없습니다.',{status:404,headers});
 const ttl=signedPhotoLifetime(p.expires_at);if(!ttl)return new NextResponse('공개 기한이 종료된 사진입니다.',{status:404,headers});
 const{data:link,error:sign}=await db.storage.from(galleryBucket).createSignedUrl(download?p.object_path:p.preview_path,ttl,download?{download:true}:undefined);
 if(sign||!link)return new NextResponse('사진을 불러오지 못했습니다.',{status:503,headers});
 return NextResponse.redirect(link.signedUrl,{status:302,headers});
 }catch{return new NextResponse('사진을 불러오지 못했습니다.',{status:503,headers});}
}

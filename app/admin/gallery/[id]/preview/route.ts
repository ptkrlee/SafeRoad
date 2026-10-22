import {adminGalleryPreview} from '@/lib/admin-gallery-preview';
import {configured,database} from '@/lib/supabase';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{if(configured())return await adminGalleryPreview((await params).id,await database());}catch{}
 return new Response('사진 미리보기를 불러올 수 없습니다.',{status:503,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
}

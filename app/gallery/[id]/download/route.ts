import {galleryResponse} from '@/lib/gallery-response';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){return galleryResponse((await params).id,true);}

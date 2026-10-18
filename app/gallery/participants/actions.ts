'use server';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {participantGalleryConfigured,participantGalleryDatabase} from '@/lib/participant-gallery-server';
import {participantGalleryCookie,sessionDateFromCode,createGalleryToken} from '@/lib/participant-gallery-token';
export async function enterPhotoRoom(form:FormData){
 const code=String(form.get('code')||'').trim();const date=sessionDateFromCode(code);if(!date)redirect('/gallery/participants?error=code');
 if(!participantGalleryConfigured())redirect('/gallery/participants?error=setup');
 let sessionId='';try{const db=participantGalleryDatabase();const{data,error}=await db.from('sessions').select('id,date').eq('date',date).single();if(!error&&data)sessionId=data.id;}catch{}
 if(!sessionId)redirect('/gallery/participants?error=code');
 (await cookies()).set(participantGalleryCookie,createGalleryToken(sessionId,process.env.SUPABASE_SECRET_KEY!),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/gallery',maxAge:4*60*60});
 redirect('/gallery/participants');
}
export async function leavePhotoRoom(){(await cookies()).set(participantGalleryCookie,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/gallery',maxAge:0});redirect('/gallery/participants');}

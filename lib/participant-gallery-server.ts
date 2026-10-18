import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {participantGalleryCookie,verifyGalleryToken} from '@/lib/participant-gallery-token';
export function participantGalleryConfigured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY);}
export function participantGalleryDatabase(){if(!participantGalleryConfigured())throw new Error('Gallery server configuration missing');return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});}
export async function participantGalleryAccess(){if(!participantGalleryConfigured())return null;const token=(await cookies()).get(participantGalleryCookie)?.value;if(!token)return null;return verifyGalleryToken(token,process.env.SUPABASE_SECRET_KEY!);}

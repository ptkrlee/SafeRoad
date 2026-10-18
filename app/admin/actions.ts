'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { database } from '@/lib/supabase';
export async function login(form:FormData) {
 let ok=false;
 try {const db=await database();const {error}=await db.auth.signInWithPassword({email:String(form.get('email')||''),password:String(form.get('password')||'')});if(!error){const {data}=await db.rpc('is_admin');ok=data===true;if(!ok)await db.auth.signOut();}}catch{}
 redirect(ok?'/admin':'/admin?error=login');
}
export async function logout(){const db=await database();await db.auth.signOut();redirect('/admin');}
export async function mutate(form:FormData) {
 const kind=String(form.get('kind'));const allowed=['save_settings','manage_session','manage_application'];if(!allowed.includes(kind))redirect('/admin?error=operation');
 let error=false;
 try {const db=await database();const {data:{user}}=await db.auth.getUser();const {data:admin}=await db.rpc('is_admin');if(!user||!admin)redirect('/admin');
 const payload=Object.fromEntries(form.entries());
 const {error:failure}=await db.rpc(kind,{payload:{...payload,accepting:form.has('accepting'),published:form.has('published')}});error=!!failure;
 }catch{error=true;}
 revalidatePath('/');revalidatePath('/admin');redirect(error?'/admin?error=save':'/admin?success=1');
}

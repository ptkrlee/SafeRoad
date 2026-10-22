import {createHmac,randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
const derive=(pin:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(pin,salt,32,{N:16384,r:8,p:1},(error,key)=>error?reject(error):resolve(key)));
export async function hashEditPin(pin:string){const salt=randomBytes(16).toString('hex');return `scrypt$${salt}$${(await derive(pin,salt)).toString('hex')}`;}
export async function verifyEditPin(pin:string,hash:string){const match=/^scrypt\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(hash);if(!match)return false;const key=await derive(pin,match[1]);return timingSafeEqual(key,Buffer.from(match[2],'hex'));}
export const editCookie='saferoad-application-edit';
export type EditAccess={id:string;version:string};
export function editLimitKey(kind:string,value:string,secret:string){return createHmac('sha256',secret).update(`application-edit:${kind}:${value}`).digest('hex');}
export function createEditToken(access:EditAccess[],secret:string,now=Date.now()){const body=Buffer.from(JSON.stringify({access,expires:now+20*60*1000})).toString('base64url');return `${body}.${createHmac('sha256',secret).update('application-edit:'+body).digest('base64url')}`;}
export function verifyEditToken(token:string,secret:string,now=Date.now()):EditAccess[]|null{
 try{const[body,signature,extra]=token.split('.');if(!body||!signature||extra)return null;const expected=createHmac('sha256',secret).update('application-edit:'+body).digest();const actual=Buffer.from(signature,'base64url');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;const data=JSON.parse(Buffer.from(body,'base64url').toString());if(!Number.isFinite(data.expires)||data.expires<=now||data.expires>now+21*60*1000||!Array.isArray(data.access)||!data.access.length||data.access.length>50)return null;if(!data.access.every((a:EditAccess)=>/^[0-9a-f-]{36}$/i.test(a.id)&&/^[0-9a-f-]{36}$/i.test(a.version)))return null;return data.access;}catch{return null;}
}

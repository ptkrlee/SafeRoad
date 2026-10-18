import {createHmac,timingSafeEqual} from 'node:crypto';
export const participantGalleryCookie='saferoad-photo-room';
export function createGalleryToken(sessionId:string,secret:string,now=Date.now()){
 const body=Buffer.from(JSON.stringify({sessionId,expires:now+4*60*60*1000})).toString('base64url');
 return body+'.'+createHmac('sha256',secret).update('saferoad-photo-room:'+body).digest('base64url');
}
export function verifyGalleryToken(token:string,secret:string,now=Date.now()):{sessionId:string;expires:number}|null{
 try{const[body,signature,extra]=token.split('.');if(!body||!signature||extra)return null;const expected=createHmac('sha256',secret).update('saferoad-photo-room:'+body).digest();const got=Buffer.from(signature,'base64url');if(got.length!==expected.length||!timingSafeEqual(got,expected))return null;const data=JSON.parse(Buffer.from(body,'base64url').toString());if(!/^[0-9a-f-]{36}$/i.test(data.sessionId)||!Number.isSafeInteger(data.expires)||data.expires<=now||data.expires>now+4*60*60*1000)return null;return data;}catch{return null;}
}
export function sessionDateFromCode(code:string){if(!/^\d{8}$/.test(code))return null;const date=code.slice(0,4)+'-'+code.slice(4,6)+'-'+code.slice(6);const parsed=new Date(date+'T12:00:00Z');return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null;}

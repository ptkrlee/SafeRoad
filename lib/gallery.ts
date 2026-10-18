export const galleryBucket='saferoad-gallery';
export const photoMimeTypes=['image/jpeg','image/png','image/webp'] as const;
export const maxPhotoSize=10*1024*1024;
export type GalleryPhoto={id:string;session_id:string;object_path:string;preview_path:string;caption:string;published:boolean;visibility:'public'|'participants';expires_at:string;created_at:string;consent_confirmed_at:string|null};
export function imageExtension(mime:string){return mime==='image/jpeg'?'jpg':mime==='image/png'?'png':mime==='image/webp'?'webp':null;}
export function signedPhotoLifetime(expiresAt:string,now=Date.now()){return Math.max(0,Math.min(60,Math.floor((new Date(expiresAt).getTime()-now)/1000)));}
export function matchesImage(bytes:Uint8Array,extension:string){
 if(extension==='jpg')return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(extension==='png')return [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 return extension==='webp'&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
}

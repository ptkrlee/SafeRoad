/** Next may use an internal localhost URL; the actual Host header still identifies the browser's destination. */
export function sameOriginRequest(request:Request){
 const value=request.headers.get('origin');if(!value)return false;
 try{const origin=new URL(value);if(origin.origin!==value)return false;const url=new URL(request.url);
 const host=request.headers.get('host');const protocol=request.headers.get('x-forwarded-proto')==='https'?'https:':url.protocol;
 return host?origin.host===new URL(`${protocol}//${host}`).host&&origin.protocol===protocol:origin.origin===url.origin;
 }catch{return false;}
}

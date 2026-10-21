'use client';
import Link,{useLinkStatus} from 'next/link';
import type {ComponentProps,MouseEvent} from 'react';

// Next's router can ignore a repeated URL. Repeated menu clicks should still
// scroll to the requested section (or the top), without reloading a filled form.
function NavigationStatus(){
 const {pending}=useLinkStatus();
 return pending?<span className="navigation-status" role="status"><span className="loading-ring" aria-hidden="true"/> 페이지 이동 중…</span>:null;
}
export default function SiteLink({onClick,children,...props}:ComponentProps<typeof Link>){
 function navigate(event:MouseEvent<HTMLAnchorElement>){
  onClick?.(event);
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.currentTarget.target&&event.currentTarget.target!=='_self'||event.currentTarget.hasAttribute('download'))return;
  const destination=new URL(event.currentTarget.href);
  if(destination.origin!==location.origin||destination.pathname!==location.pathname||destination.search!==location.search)return;
  let target:HTMLElement|null=null;
  if(destination.hash){
   try{target=document.getElementById(decodeURIComponent(destination.hash.slice(1)));}catch{return;}
   if(!target)return;
  }
  event.preventDefault();
  if(destination.href!==location.href)history.pushState(null,'',destination.href);
  const behavior=matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';
  if(target){
   target.scrollIntoView({behavior,block:'start'});
   // Make the destination reachable to keyboard and screen reader users too.
   if(!target.hasAttribute('tabindex')){target.setAttribute('tabindex','-1');target.addEventListener('blur',()=>target?.removeAttribute('tabindex'),{once:true});}
   target.focus({preventScroll:true});
  }else window.scrollTo({top:0,behavior});
 }
 return <Link {...props} onClick={navigate}>{children}<NavigationStatus/></Link>;
}

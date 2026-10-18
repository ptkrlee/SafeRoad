'use client';
import {useEffect,useRef,useState} from 'react';

export default function WelcomeIntro({src}:{src:string}){
 const dismissed=useRef(false);
 const [phase,setPhase]=useState<'hidden'|'visible'|'leaving'>('hidden');
 useEffect(()=>{
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  try{if(sessionStorage.getItem('saferoad-welcome-seen'))return;}catch{}
  const photo=new Image();let active=true;let leave:ReturnType<typeof setTimeout>;let end:ReturnType<typeof setTimeout>;
  photo.onload=()=>{if(!active||dismissed.current)return;try{sessionStorage.setItem('saferoad-welcome-seen','1');}catch{}setPhase('visible');leave=setTimeout(()=>{if(!dismissed.current)setPhase('leaving');},1800);end=setTimeout(()=>setPhase('hidden'),2500);};
  photo.src=src;
  return()=>{active=false;clearTimeout(leave);clearTimeout(end);};
 },[src]);
 if(phase==='hidden')return null;
 return <div className={`welcome-intro ${phase==='leaving'?'is-leaving':''}`} aria-label="오륙도에 오신 것을 환영합니다"><img src={src} alt="바다 위 오륙도와 등대"/><div className="welcome-shade"/><div className="welcome-copy"><p>사단법인 부산치유협회와 함께</p><h2>오륙도에서 만나는<br/>건강한 한 걸음.</h2><span>코리아둘레길 · 오륙도 안전걷기로드</span></div><button type="button" onClick={()=>{dismissed.current=true;setPhase('hidden');}}>바로 들어가기 ↗</button></div>;
}

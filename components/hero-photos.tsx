'use client';
import {useEffect,useState} from 'react';
import {heroPhotos} from '@/lib/site-photos';
export default function HeroPhotos(){
 const [active,setActive]=useState(0);const[playing,setPlaying]=useState(true);const[visible,setVisible]=useState(true);const[introReady,setIntroReady]=useState(false);
 useEffect(()=>{const visibility=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',visibility);visibility();return()=>document.removeEventListener('visibilitychange',visibility);},[]);
 useEffect(()=>{const ready=()=>setIntroReady(true);if(document.documentElement.dataset.welcome!=='show')ready();window.addEventListener('saferoad:welcome-finished',ready);return()=>window.removeEventListener('saferoad:welcome-finished',ready);},[]);
 useEffect(()=>{if(!playing||!visible||!introReady)return;const timer=setTimeout(()=>setActive(current=>(current+1)%heroPhotos.length),3000);return()=>clearTimeout(timer);},[active,playing,visible,introReady]);
 const previous=(active+heroPhotos.length-1)%heroPhotos.length;const next=(active+1)%heroPhotos.length;const shown=[previous,active,next];
 function move(direction:number){setActive(current=>(current+direction+heroPhotos.length)%heroPhotos.length);}
 return <div className="hero-carousel" role="region" aria-label="오륙도 체험 현장 사진" data-playing={playing&&visible&&introReady}>
  <div className="hero-photo-stage" aria-live="off">{shown.map(index=>{const photo=heroPhotos[index];return <div className={`hero-slide ${index===active?'is-active':''}`}  key={photo.src} aria-hidden={index!==active}><img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} style={{objectPosition:photo.position}}  fetchPriority={index===active||index===next?'high':'low'} loading="eager" decoding="async"/></div>;})}<div className="hero-photo-veil" aria-hidden="true"/></div>
  <div className="hero-photo-caption"><span>OUR WALK, OUR MOMENTS</span><p>{heroPhotos[active].caption}</p></div>
  <div className="hero-photo-controls"><span className="hero-photo-counter" aria-label={`전체 ${heroPhotos.length}장 중 ${active+1}번째 사진`}>{String(active+1).padStart(2,'0')} <i>/ {String(heroPhotos.length).padStart(2,'0')}</i></span><button type="button" onClick={()=>move(-1)} aria-label="이전 체험 사진">←</button><button type="button" onClick={()=>setPlaying(value=>!value)} aria-label={playing?'사진 자동 전환 일시정지':'사진 자동 전환 시작'}>{playing?'Ⅱ':'▷'}</button><button type="button" onClick={()=>move(1)} aria-label="다음 체험 사진">→</button></div>
 </div>;
}

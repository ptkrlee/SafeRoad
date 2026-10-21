'use client';
import {useEffect,useState} from 'react';
import {heroPhotos} from '@/lib/site-photos';
export default function HeroPhotos(){
 const [active,setActive]=useState(0);const[playing,setPlaying]=useState(false);const[hovered,setHovered]=useState(false);const[focused,setFocused]=useState(false);const[visible,setVisible]=useState(true);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');setPlaying(!media.matches);const motion=()=>{if(media.matches)setPlaying(false);};const visibility=()=>setVisible(!document.hidden);media.addEventListener('change',motion);document.addEventListener('visibilitychange',visibility);visibility();return()=>{media.removeEventListener('change',motion);document.removeEventListener('visibilitychange',visibility);};},[]);
 useEffect(()=>{if(!playing||hovered||focused||!visible)return;const timer=setInterval(()=>setActive(current=>(current+1)%heroPhotos.length),7500);return()=>clearInterval(timer);},[playing,hovered,focused,visible]);
 const previous=(active+heroPhotos.length-1)%heroPhotos.length;const next=(active+1)%heroPhotos.length;const shown=[previous,active,next];
 function move(direction:number){setPlaying(false);setActive(current=>(current+direction+heroPhotos.length)%heroPhotos.length);}
 return <div className="hero-carousel" role="region" aria-label="오륙도 체험 현장 사진" data-playing={playing&&!hovered&&!focused&&visible} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setFocused(false);}}>
  <div className="hero-photo-stage" aria-live="off">{shown.map(index=>{const photo=heroPhotos[index];return <div className={`hero-slide ${index===active?'is-active':''} ${photo.width<600?'is-detail':''}`} style={photo.width<600?{backgroundImage:`url(${heroPhotos[0].src})`}:undefined} key={photo.src} aria-hidden={index!==active}><img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} style={{objectPosition:photo.position}} fetchPriority={index===0?'high':'auto'} loading={index===active?'eager':'lazy'} decoding="async"/></div>;})}<div className="hero-photo-veil" aria-hidden="true"/></div>
  <div className="hero-photo-caption"><span>OUR WALK, OUR MOMENTS</span><p>{heroPhotos[active].caption}</p></div>
  <div className="hero-photo-controls"><span className="hero-photo-counter" aria-label={`전체 ${heroPhotos.length}장 중 ${active+1}번째 사진`}>{String(active+1).padStart(2,'0')} <i>/ {String(heroPhotos.length).padStart(2,'0')}</i></span><button type="button" onClick={()=>move(-1)} aria-label="이전 체험 사진">←</button><button type="button" onClick={()=>{setPlaying(value=>!value);setFocused(false);setHovered(false);}} aria-label={playing?'사진 자동 전환 일시정지':'사진 자동 전환 시작'}>{playing?'Ⅱ':'▷'}</button><button type="button" onClick={()=>move(1)} aria-label="다음 체험 사진">→</button></div>
 </div>;
}

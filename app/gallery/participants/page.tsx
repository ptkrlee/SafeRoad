import GalleryTabs from '@/components/gallery-tabs';
import GalleryEmpty from '@/components/gallery-empty';
import PhoneText from '@/components/phone-text';
import CoastalHeading from '@/components/coastal-heading';
import ReadableText from '@/components/readable-text';
import Link from '@/components/site-link';
import {participantGalleryAccess,participantGalleryConfigured,participantGalleryDatabase} from '@/lib/participant-gallery-server';
import {formatGalleryDate} from '@/lib/domain';
import {enterPhotoRoom,leavePhotoRoom} from './actions';
export const dynamic='force-dynamic';
export const metadata={title:'완보자 사진방 | 오륙도 안전걷기로드',robots:{index:false,follow:false}};
export default async function ParticipantGallery({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const params=await searchParams;const page=Math.max(0,Math.min(100000,Number.parseInt(params.page||'0',10)||0));const access=await participantGalleryAccess();const ready=participantGalleryConfigured();
 let photos:{id:string;caption:string}[]=[];let date='';let count=0;let failed=false;
 if(access)try{const db=participantGalleryDatabase();const{data:s,error:se}=await db.from('sessions').select('date').eq('id',access.sessionId).single();if(se||!s)throw new Error('Session unavailable');date=s.date;
 const{data,error,count:n}=await db.from('gallery_photos').select('id,caption',{count:'exact'}).eq('session_id',access.sessionId).eq('visibility','participants').eq('published',true).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*24,page*24+23);if(error)throw new Error('Photos unavailable');photos=data||[];count=n||0;
 }catch{failed=true;}
 return <main className="section public-page gallery-page"><CoastalHeading><p className="eyebrow">YOUR WALK, YOUR MEMORIES</p><h1>완보자 사진방</h1></CoastalHeading><GalleryTabs active="participants"/><p>체험 현장에서 안내받은 날짜코드를 입력하면 해당 회차 사진을 보고 다운로드할 수 있습니다. 예: 2026년 11월 14일 → <b>20261114</b></p><p className="notice"><ReadableText text={'입장코드를 아는 사람이 함께 이용하는 사진방입니다. 참가자 개별 인증은 하지 않으며 날짜를 아는 외부인도 코드를 추측할 수 있습니다. 다른 사람의 사진을 외부에 다시 게시하지 말아주세요.'}/></p>{!ready?<GalleryEmpty title="완보자 사진방을 준비하고 있습니다." description="사진방이 열리면 현장에서 안내받은 날짜코드로 이용하실 수 있습니다."/>:!access?<form action={enterPhotoRoom} className="login narrow-form"><label>체험 날짜코드 (숫자 8자리)<input name="code" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{8}" minLength={8} maxLength={8} required placeholder="현장에서 안내받은 날짜코드"/></label>{params.error&&<p className="error" role="alert">코드 또는 연결 상태를 확인해주세요.</p>}<button className="button">사진방 입장하기 ↗</button></form>:<><div className="section-heading"><h2>{date?formatGalleryDate(date):'해당 회차'}의 걷기 기록</h2><form action={leavePhotoRoom}><button className="small-button">다른 회차 코드 입력</button></form></div>{failed?<p className="error" role="alert">사진을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</p>:!photos.length?<GalleryEmpty title="아직 게시된 사진이 없습니다."/>:<div className="photo-grid">{photos.map(p=><article className="photo-card" key={p.id}><a href={`/gallery/${p.id}/download`}><img src={`/gallery/${p.id}/image`} alt={p.caption||'완보자 체험 사진'} loading="lazy" referrerPolicy="no-referrer"/></a><div>{p.caption&&<p>{p.caption}</p>}<a className="small-button" href={`/gallery/${p.id}/download`}>사진 다운로드 ↓</a></div></article>)}</div>}<div className="pagination">{page>0&&<Link href={`/gallery/participants?page=${page-1}`}>← 이전</Link>}<span>{page+1} / {Math.max(1,Math.ceil(count/24))}</span>{(page+1)*24<count&&<Link href={`/gallery/participants?page=${page+1}`}>다음 →</Link>}</div></>}<p className="muted">게시 중단·삭제 요청은 <PhoneText value="010-9679-9817"/>로 문자를 남겨주세요.</p></main>;
}

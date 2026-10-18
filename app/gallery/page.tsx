import Link from 'next/link';
import {configured,database} from '@/lib/supabase';
import {formatDate} from '@/lib/domain';
export const dynamic='force-dynamic';
export const metadata={title:'체험 사진 갤러리 | 오륙도 안전걷기로드'};
export default async function Gallery({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const params=await searchParams;const page=Math.max(0,Math.min(100000,Number.parseInt(params.page||'0',10)||0));
 const session=/^[0-9a-f-]{36}$/i.test(params.session||'')?params.session!:'';
 let result:{id:string;session_id:string;caption:string;url:string}[]=[];let count=0;let ready=false;let failed=false;let sessions:{id:string;date:string}[]=[];
 if(configured())try{const db=await database();const{data:setting}=await db.from('settings').select('consent_revision').eq('id',1).single();
  if(setting?.consent_revision>=4){ready=true;const dates=await db.from('sessions').select('id,date').order('date');sessions=dates.data||[];
   let query=db.from('gallery_photos').select('id,session_id,caption,object_path,preview_path,expires_at',{count:'exact'}).eq('visibility','public').eq('published',true).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).order('id',{ascending:false});if(session)query=query.eq('session_id',session);
   const photos=await query.range(page*24,page*24+23);if(photos.error)throw new Error('Gallery unavailable');count=photos.count||0;
   result=(photos.data||[]).map(p=>({id:p.id,session_id:p.session_id,caption:p.caption,url:`/gallery/${p.id}/image`}));
  }
 }catch{failed=true;}
 const link=(n:number)=>`/gallery?page=${n}${session?`&session=${encodeURIComponent(session)}`:''}`;
 return <main className="section"><p className="eyebrow">MOMENTS ON THE ROAD</p><h1>공식 공개 갤러리</h1><div className="gallery-tabs"><Link href="/gallery" aria-current="page">공식 공개 갤러리</Link><Link href="/gallery/participants">완보자 사진방</Link></div><p>오륙도 안전걷기로드 체험 사진 갤러리입니다. 공개 게시에 동의한 사진을 관리자가 확인해 게시합니다.</p><p className="notice">이 갤러리는 누구나 열람할 수 있으며 다운로드 기능은 제공하지 않습니다. 참가자 사진 다운로드는 완보자 사진방을 이용해주세요. 다른 사람의 사진을 무단으로 재게시하거나 상업적으로 이용하지 말아주세요. 게시물 삭제 요청은 <a href="sms:01096799817">010-9679-9817</a>로 문자를 남겨주세요.</p>{!ready?<div className="empty">갤러리를 준비하고 있습니다. 사진은 아직 공개되지 않습니다.</div>:<><form method="get" className="filter"><label>체험 회차<select name="session" defaultValue={session}><option value="">전체 회차</option>{sessions.map(s=><option key={s.id} value={s.id}>{formatDate(s.date)}</option>)}</select></label><button className="small-button">사진 보기</button></form>{failed&&<p className="error" role="alert">일부 사진을 불러오지 못했습니다. 잠시 후 새로고침해주세요.</p>}{!result.length&&!failed?<div className="empty">아직 공개된 사진이 없습니다.</div>:<div className="photo-grid">{result.map(p=><article className="photo-card" key={p.id}><img src={p.url} alt={p.caption||'오륙도 안전걷기로드 체험 사진'} loading="lazy" referrerPolicy="no-referrer"/><div><small>{sessions.find(s=>s.id===p.session_id)?.date}</small>{p.caption&&<p>{p.caption}</p>}</div></article>)}</div>}<div className="pagination">{page>0&&<Link href={link(page-1)}>← 이전 사진</Link>}<span>{page+1} / {Math.max(1,Math.ceil(count/24))}</span>{(page+1)*24<count&&<Link href={link(page+1)}>다음 사진 →</Link>}</div></>}</main>;
}

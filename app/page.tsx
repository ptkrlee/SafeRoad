import CompletedSessions from '@/components/completed-sessions';
import {siteUrl,siteName,siteDescription} from '@/lib/seo';
import SiteLink from '@/components/site-link';
import HeroPhotos from '@/components/hero-photos';
import {programPhotos} from '@/lib/site-photos';
import ReadableText from '@/components/readable-text';
import ProgramIcon,{type ProgramIconName} from '@/components/program-icon';
import { publicData } from '@/lib/data';
import ApplicationForm from '@/components/application-form';
import ProgramGuide from '@/components/program-guide';
export const dynamic='force-dynamic';
export const metadata={alternates:{canonical:'/'}};
const searchInformation={
 '@context':'https://schema.org','@graph':[
 {'@type':'Organization','@id':`${siteUrl}/#organization`,name:'사단법인 부산치유협회',url:siteUrl,logo:`${siteUrl}/images/busan-therapy-full.png`},
 {'@type':'WebSite','@id':`${siteUrl}/#website`,url:siteUrl,name:siteName,description:siteDescription,inLanguage:'ko-KR',publisher:{'@id':`${siteUrl}/#organization`}},
 ],
};
export default async function Home() {
 const data=await publicData();
 const migrationPending=data.connected&&data.settings.consent_revision!==4;
 return <main><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(searchInformation).replace(/</g,'\\u003c')}}/><section className="hero"><div className="hero-copy"><p className="eyebrow">BUSAN NAM-GU · KOREA DULLEGIL</p><span className="pill">전문가와 함께하는 걷기 체험</span><h1>바다를 곁에 두고,<br/>건강한 한 걸음.</h1><p className="intro">오륙도에서 시작하는 안전한 걷기 습관.<br/>테이핑부터 바른 걷기, 자가회복까지 함께해요.</p><SiteLink className="button" href="#apply">체험 일정 확인하기 <span>↗</span></SiteLink><div className="hero-facts"><span>참가비 <b>1인 10,000원</b></span><span>회차별 <b>최대 30명</b></span></div></div><HeroPhotos/></section>
 <section id="program" className="section"><p className="eyebrow">A WALK FOR YOUR WELLBEING</p><h2>잘 걷는 법부터, 나를 돌보는 시간까지</h2><div className="cards experience-photo-grid">{[
 {photo:programPhotos.taping,step:'01 / PREPARE',title:'안전걷기 테이핑',label:'몸을 준비하는 시간',body:'전문가의 안내에 따라 걷기 전 몸을 준비합니다.'},
 {photo:programPhotos.walking,step:'02 / WALK',title:'바른자세 걷기',label:'바다와 숲을 잇는 걸음',body:'해안길을 걸으며 나에게 맞는 올바른 자세를 배웁니다.'},
 {photo:programPhotos.recovery,step:'03 / RECOVER',title:'자가회복 프로그램',label:'나를 돌보며 마무리',body:'걷기 후 몸을 돌보는 회복 프로그램을 경험합니다.'},
 ].map(({photo,step,title,label,body})=><article className="photo-experience" key={step}><div className="experience-photo"><img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" style={{objectPosition:photo.position}}/><span>{step}</span></div><div className="experience-photo-copy"><small>{label}</small><h3>{title}</h3><p><ReadableText text={body}/></p></div></article>)}</div><div className="program-details"><div><small>집결 장소</small><strong>오륙도 관광안내소 1층 오륙도 홍보관 · 오전 9시 30분 집결</strong><p><ReadableText text={'종료 예정: 낮 12시 30분~오후 1시경'}/></p></div><div><small>참가 대상</small><strong>부산시민 및 관광객 · 2시간 이상 걷기 가능한 분</strong></div><div><small>코스 안내</small><strong>해파랑길 1코스 왕복 4km / 남파랑길 1코스 왕복 6km</strong><p><ReadableText text={'회차별 코스와 시작 시간은 일정에서 확인해주세요.'}/></p></div><div><small>운영 안내</small><strong>최소 10명 · 최대 30명</strong><p><ReadableText text={'기상 악화·인원 미달 등으로 취소될 수 있습니다. 회차별 안내일에 진행 여부를 문자로 안내합니다.'}/></p></div></div></section>
 <ProgramGuide/>
 <div className="section past-history-section"><CompletedSessions sessions={data.sessions}/></div>
 <section id="apply" className="section application-section"><div className="section-heading"><div><p className="eyebrow">RESERVE YOUR WALK</p><h2>함께 걸을 날짜를 선택해주세요 <span className="required-mark" aria-hidden="true">*</span><span className="sr-only"> (필수 선택)</span></h2></div><span className="pill">체험 일정 · 운영 기록</span></div><h3 className="upcoming-sessions-heading">2026 앞으로의 체험 일정</h3>{(!data.connected||migrationPending) && <p className="notice" role="status">{migrationPending?'신청 안내를 업데이트하고 있습니다. 잠시 후 다시 확인해주세요.':data.error?'신청 시스템 연결을 확인하고 있습니다. 잠시 후 다시 확인해주세요.':'신청서 미리보기입니다. 날짜를 선택하고 가상정보로 작성해보세요. 입력한 내용은 저장·접수되지 않습니다. 현재는 입금하지 마세요.'}</p>}<ApplicationForm {...data} connected={data.connected&&!migrationPending} preview={!data.connected&&!data.error}/></section>
 <section className="section guidelines"><p className="eyebrow">WALK SAFELY, WALK TOGETHER</p><h2>함께 걷기 전, 확인해주세요</h2><p className="guidelines-intro">모두가 편안하고 안전하게 걷기 위한 네 가지 약속입니다.</p><div className="precaution-grid">{([
 ['guide','전문가의 안내를 따라주세요','진행자의 설명을 듣고 안전하게 참여해주세요. 몸이 불편하면 바로 알려주세요.'],
 ['nature','자연을 함께 지켜주세요','식물 채취와 쓰레기 투기는 하지 않습니다. 쓰레기는 되가져가 주세요.'],
 ['clock','집결 시간을 지켜주세요','오전 9시 30분까지 집결해주세요. 늦거나 참여가 어려우면 사무국에 알려주세요.'],
 ['people','함께 걷는 이웃을 배려해주세요','큰 소리와 통행 방해를 삼가고, 다른 참가자와 지역 주민을 배려해주세요.']
 ] as [ProgramIconName,string,string][]).map(([icon,title,body],index)=><article className="precaution-card" key={icon}><div className="precaution-visual"><ProgramIcon name={icon}/><span>0{index+1}</span></div><div className="precaution-copy"><h3>{title}</h3><p><ReadableText text={body}/></p></div></article>)}</div></section></main>;
}

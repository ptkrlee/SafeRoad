import SiteLink from '@/components/site-link';
import ReadableText from '@/components/readable-text';
import ProgramGuide from '@/components/program-guide';
export const metadata={title:'프로그램·참가 안내 | 오륙도 안전걷기로드',description:'부산 남구 오륙도 안전걷기 체험의 테이핑·바른자세 걷기·자가회복 활동, 해파랑길과 남파랑길 코스, 집결 장소와 준비물, 참가 전 자주 확인하는 내용을 안내합니다.',alternates:{canonical:'/guide'}};
export default function Guide(){return <main><section className="section guide-heading"><p className="eyebrow">YOUR GUIDE TO A SAFER WALK</p><h1>알고 걸으면,<br/>더 편안한 오륙도.</h1><p><ReadableText text={'프로그램 구성부터 코스, 준비물과 참여 전 확인할 내용까지 안내합니다.'}/></p><SiteLink className="button" href="/#apply">일정 확인·체험 신청 ↗</SiteLink></section><ProgramGuide/></main>}

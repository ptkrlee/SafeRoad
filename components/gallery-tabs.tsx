import Link from '@/components/site-link';
import ProgramIcon from '@/components/program-icon';
export default function GalleryTabs({active}:{active:'public'|'participants'}){
 return <nav className="gallery-tabs" aria-label="사진 갤러리 선택"><Link href="/gallery" aria-current={active==='public'?'page':undefined}><span className="gallery-tab-icon"><ProgramIcon name="rest"/></span><span><strong>공식 공개 갤러리</strong><small>체험의 순간을 함께 둘러보세요</small></span><span className="gallery-tab-arrow" aria-hidden="true">↗</span></Link><Link href="/gallery/participants" aria-current={active==='participants'?'page':undefined}><span className="gallery-tab-icon"><ProgramIcon name="people"/></span><span><strong>완보자 사진방</strong><small>날짜코드로 내 회차 사진 확인</small></span><span className="gallery-tab-arrow" aria-hidden="true">↗</span></Link></nav>;
}

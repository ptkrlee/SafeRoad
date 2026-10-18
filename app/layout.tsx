import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata={title:'코리아둘레길 · 오륙도 안전걷기로드',description:'전문가와 함께 걷는 오륙도 안전걷기로드 체험프로그램'};
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="ko"><body><header className="header"><Link href="/" className="brand"><span className="brand-icon">↗</span><span>코리아둘레길<small>오륙도 안전걷기로드</small></span></Link><nav><Link href="/guide">프로그램 소개</Link><Link href="/#apply">체험 신청</Link><Link href="/gallery">사진 갤러리</Link><Link href="/admin">관리자</Link></nav></header>{children}<footer><strong>오륙도 안전걷기로드 · 부산치유협회</strong><p>취소·문의는 <a href="sms:01096799817">010-9679-9817</a>로 문자를 남겨주세요. 순차적으로 안내해드립니다.</p><small>신청자의 개인정보는 공개되지 않으며, 권한이 있는 관리자만 확인합니다.</small></footer></body></html> }

import { z } from 'zod';
export const applicationSchema = z.object({
  sessionId: z.string().uuid(), name: z.string().trim().min(2, '이름을 입력해주세요.').max(50),
  address: z.string().trim().min(2, '시·군·구를 입력해주세요.').max(100),
  phone: z.string().transform(v => v.replace(/[\s-]/g, '')).pipe(z.string().regex(/^01[016789]\d{7,8}$/, '휴대전화 번호를 확인해주세요.')),
  people: z.coerce.number().int().min(1).max(30),
  depositor: z.string().trim().min(2, '입금자명을 입력해주세요.').max(50),
  feeConsent: z.literal(true), refundConsent: z.literal(true), privacyConsent: z.literal(true),
  website: z.string().max(0).default(''),
});
export type Session = { id: string; date: string; start_time: string | null; course: string | null; capacity: number; minimum: number; accepting: boolean; cancelled: boolean; notice_date: string | null; booked: number };
export type Settings = { bank: string; account: string; holder: string; fee: number; privacy_text: string; refund_text: string; published: boolean; version: number };
export const initialSettings: Settings = { bank: '농협', account: '301-0365-1653-61', holder: '부산치유협회', fee: 10000, privacy_text: '', refund_text: '', published: false, version: 1 };
export const initialSessions: Session[] = [
  { id:'00000000-0000-4000-8000-000000000001', date:'2026-10-23', notice_date:'2026-10-22', course:'해파랑길 1코스 · 왕복 4km' },
  { id:'00000000-0000-4000-8000-000000000002', date:'2026-11-14', notice_date:'2026-11-13', course:'남파랑길 1코스 · 왕복 6km' },
  { id:'00000000-0000-4000-8000-000000000003', date:'2026-11-21', notice_date:'2026-11-20', course:'해파랑길 1코스 · 왕복 4km' },
].map(s => ({ ...s, start_time:'09:30:00', capacity:30, minimum:10, accepting:false, cancelled:false, booked:0 }));
export function formatDate(value:string) { return new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', month:'long', day:'numeric', weekday:'short' }).format(new Date(value+'T12:00:00+09:00')); }
export function koreaToday() { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date()); }
export function canApply(s:Session, settings:Settings, today=koreaToday()) { return settings.published && s.accepting && !s.cancelled && s.date >= today && s.booked < s.capacity; }

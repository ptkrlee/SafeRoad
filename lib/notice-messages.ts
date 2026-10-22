import {withOfficeContact} from './contact';
import {canApply,formatDate,koreaToday,type Session,type Settings} from './domain';
export type NoticeKind='confirmed'|'cancelled'|'unpaid';
export type NoticeRecipient={id:string;session_id:string;original_session_id:string;name:string|null;phone:string|null;people:number|null;status:string|null;payment:string|null;refund:string|null;notice:string|null;moved:boolean};
export function noticeRecipients(applications:NoticeRecipient[],sessionId:string,kind:NoticeKind){
 return applications.filter(a=>a.session_id===sessionId&&(kind==='cancelled'?(a.status==='active'||a.status==='cancelled'):a.status==='active'&&(kind!=='unpaid'||a.payment==='unconfirmed')));
}
export function changeOptions(sessions:Session[],settings:Settings,sessionId:string,today=koreaToday()){
 return sessions.filter(s=>s.id!==sessionId&&canApply(s,settings,today)).sort((a,b)=>a.date.localeCompare(b.date));
}
export function noticeDeadlineDefaults(date:string|undefined){return date==='2026-10-23'?{date:'2026-10-22',time:'15:00'}:{date:'',time:''};}
function timeLabel(value:string|null){if(!value)return '집결 시간은 사무국에서 별도 안내합니다.';const[h,m]=value.split(':').map(Number);return `${h<12?'오전':'오후'} ${h%12||12}시${m?` ${m}분`:''}`;}
function createNoticeMessage({kind,session,settings,alternatives=[],reason='',missedCall=false,deadlineDate='',deadlineTime='',extra=''}:{kind:NoticeKind;session:Session;settings:Settings;alternatives?:Session[];reason?:string;missedCall?:boolean;deadlineDate?:string;deadlineTime?:string;extra?:string}){
 const date=`${session.date.slice(0,4)}년 ${formatDate(session.date)}`;
 const contact='문의·취소·변경: 010-9679-9817\n문자를 남겨주시면 순차적으로 안내해드리겠습니다.';
 const added=extra.trim()?`\n\n${extra.trim()}`:'';
 if(kind==='confirmed')return `[오륙도 안전걷기로드 체험 진행 안내]\n\n안녕하세요. 사단법인 부산치유협회입니다.\n신청하신 오륙도 안전걷기로드 체험프로그램의 진행을 안내드립니다.\n\n▶ 체험일: ${date}\n▶ 집결: ${timeLabel(session.start_time)}${session.start_time?'까지 집결':''}\n▶ 종료 예정: 낮 12시 30분~오후 1시경\n▶ 집결장소: 오륙도 관광안내소 1층 '오륙도 홍보관' (CU편의점 맞은편)\n▶ 걷기 코스: ${session.course||'사무국 별도 안내'}\n▶ 준비물: 운동화, 편한 복장, 개별 배낭\n▶ 프로그램: 안전교육, 테이핑 체험, 준비운동, 바른자세 걷기 지도, 반환점 휴식·포토타임, 자가회복 프로그램\n▶ 테이핑은 무릎에 적용할 예정입니다. 긴바지는 무릎 위까지 올릴 수 있는 바지를 권장드립니다. 테이프 알레르기나 피부 상처가 있다면 진행자에게 먼저 알려주세요.\n\n현장 상황에 따라 종료 시각은 달라질 수 있습니다. 여유 있게 도착해주시기 바랍니다.${added}\n\n${contact}\n\n감사합니다.`;
 if(kind==='cancelled')return `[안내] ${formatDate(session.date)} 오륙도 안전걷기체험 취소 및 후속 안내\n\n안녕하세요. 사단법인 부산치유협회입니다.${missedCall?'\n전화 연결이 되지 않아 문자로 안내드리는 점 양해 부탁드립니다.':''}\n\n신청해주신 ${date} 체험프로그램이 ${reason.trim()||'부득이한 사정'}에 따라 취소되었습니다.\n기대하셨을 텐데 불편을 드려 진심으로 죄송합니다.\n\n${alternatives.length?`■ 선택 사항\n1. 일정 변경: ${alternatives.map(s=>`${formatDate(s.date)} · ${(s.course||'코스 별도 안내').replace(/\s*·\s*왕복.*$/,'')}`).join('\n   ')}\n2. 전액 환불\n\n변경 또는 환불 의사를 문자로 회신 부탁드리며,`:'현재 안내 가능한 변경 회차가 없어 전액 환불을 안내드립니다.\n환불 의사를 문자로 회신 부탁드리며,'} 금번 취소 건은 주최 측 취소로, 입금하신 참가비는 이체수수료 공제 없이 전액 환불해드립니다.${added}\n\n다시 한번 죄송한 말씀을 드립니다.\n\n문의·취소·변경: 010-9679-9817\n문자를 남겨주시면 순차적으로 안내해드리겠습니다.\n\n감사합니다.`;
 const deadline=deadlineDate?`▶ 입금 기한: ${deadlineDate.slice(0,4)}년 ${formatDate(deadlineDate)}${deadlineTime?` ${timeLabel(deadlineTime)}`:''}`:'▶ 입금 기한: 신청 후 즉시 입금해주세요.';
 return `[오륙도 안전걷기로드 체험 프로그램 참가비 입금 안내]\n\n안녕하세요. 사단법인 부산치유협회입니다.\n${date} 체험프로그램에 신청하셨으나 현재 참가비 입금이 확인되지 않아 안내드립니다.\n\n${deadline}\n▶ 참가비: 1인 ${settings.fee.toLocaleString()}원 (신청 인원수에 맞춰 입금)\n▶ 입금 계좌: ${settings.bank} ${settings.account}\n▶ 예금주: ${settings.holder||'사무국에 확인해주세요'}\n\n※ 신청서에 적으신 입금자명으로 입금해주세요. 다른 성함으로 입금하셨거나 이미 입금하신 경우, 입금자명을 문자로 알려주시면 확인하겠습니다.${added}\n\n${contact}\n\n감사합니다.`;
}

export function buildNoticeMessage(input:Parameters<typeof createNoticeMessage>[0]){return withOfficeContact(createNoticeMessage(input));}

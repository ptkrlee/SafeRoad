import {formatDate,type Session} from '@/lib/domain';
import {completedHistory} from '@/lib/confirmed-history';
export default function CompletedSessions({sessions}:{sessions:Session[]}){
 const completed=completedHistory(sessions);
 return <section className="completed-sessions" aria-labelledby="completed-heading"><div className="completed-heading"><h3 id="completed-heading">2026 지난 체험 운영 기록</h3><span className="completed-count">누적 <b>{completed.length}회</b> 운영 완료</span></div><div className="sessions completed-session-grid">{completed.map(s=><article className="session completed-session" key={s.date}><span className="completed-label">✓ 운영 완료</span><strong><time dateTime={s.date}>{s.date.slice(0,4)}년 {formatDate(s.date)}</time></strong><span className="completed-course">{s.course}</span></article>)}</div></section>;
}

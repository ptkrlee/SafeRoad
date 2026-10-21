import {formatDate,type Session} from '@/lib/domain';
export default function CompletedSessions({sessions}:{sessions:Session[]}){
 const completed=sessions.filter(s=>s.completed&&!s.cancelled).sort((a,b)=>a.date.localeCompare(b.date));
 if(!completed.length)return null;
 return <section className="completed-sessions" aria-labelledby="completed-heading"><div className="completed-heading"><div><p className="eyebrow">OUR WALKS SO FAR</p><h3 id="completed-heading">함께 걸어온 체험 기록</h3></div><span className="completed-count">누적 <b>{completed.length}회</b> 운영 완료</span></div><p className="completed-intro">실제 진행을 마친 회차입니다. 종료된 일정은 신청할 수 없습니다.</p><div className="sessions completed-session-grid">{completed.map(s=><article className="session completed-session" key={s.id}><div className="completed-badges"><span>모집 완료</span><span><i aria-hidden="true">✓</i> 운영 종료</span></div><strong>{s.date.slice(0,4)}년 {formatDate(s.date)}</strong>{s.start_time&&<span>{s.start_time.slice(0,5)} 집결</span>}{s.course&&<span>{s.course}</span>}<small>함께 걸으며 추억을 남긴 체험</small></article>)}</div></section>;
}

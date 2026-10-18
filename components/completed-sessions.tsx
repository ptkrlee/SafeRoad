import {formatDate,type Session} from '@/lib/domain';
export default function CompletedSessions({sessions}:{sessions:Session[]}){
 const completed=sessions.filter(s=>s.completed).sort((a,b)=>b.date.localeCompare(a.date));
 if(!completed.length)return null;
 return <div className="completed-sessions"><h3>함께 걸었던 날들</h3><p>실제 진행을 마친 체험 일정입니다.</p><div className="completed-dates">{completed.map(s=><span className="completed-date" key={s.id}><span aria-hidden="true">✓</span> {s.date.slice(0,4)}년 {formatDate(s.date)} <b>(종료)</b></span>)}</div></div>;
}

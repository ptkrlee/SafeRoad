// The operator confirmed on 2026-10-22 that rounds 1–5 actually took place.
export const confirmedHistory=[
 {date:'2026-04-25',course:'해파랑길 1코스 · 왕복 4km'},
 {date:'2026-05-09',course:'남파랑길 1코스 · 왕복 6km'},
 {date:'2026-05-30',course:'해파랑길 1코스 · 왕복 4km'},
 {date:'2026-09-19',course:'남파랑길 1코스 · 왕복 6km'},
 {date:'2026-10-03',course:'해파랑길 1코스 · 왕복 4km'},
] as const;

// Public historical facts do not depend on whether old signup data was imported.
// Database records can add later completed rounds without duplicating these dates.
export function completedHistory(sessions:import('./domain').Session[]){
 const records=new Map<string,{date:string;course:string}>(confirmedHistory.map(round=>[round.date,{...round}]));
 for(const session of sessions){
  if(!session.completed||session.cancelled)continue;
  records.set(session.date,{date:session.date,course:session.course||records.get(session.date)?.course||'코스 기록 확인 중'});
 }
 return [...records.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

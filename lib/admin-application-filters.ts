import type {database} from './supabase';
import type {Session} from './domain';
export const rosterChoices={
 status:[['','전체'],['current','종료 회차 제외 · 전체 상태'],['active','참여 예정'],['attendance_unknown','종료 회차 · 참석 미확인'],['attended','참석 확인'],['no_show','미참석 확인'],['cancelled','취소'],['missing','기록 없음(공란)']],
 payment:[['','전체'],['unconfirmed','입금 미확인'],['paid','입금 확인'],['missing','기록 없음(공란)']],
 refund:[['','전체'],['none','환불 해당 없음'],['pending','환불 대기'],['completed','환불 완료'],['missing','기록 없음(공란)']],
 notice:[['','전체'],['needed','안내 필요'],['contacted','연락 확인 완료'],['missing','기록 없음(공란)']],
 sort:[['newest','최근 접수순'],['oldest','오래된 접수순'],['name','이름 가나다순'],['name_desc','이름 역순'],['unpaid','입금 미확인 먼저'],['contact','안내 필요 먼저'],['refund','환불 대기 먼저']],
} as const;
export type RosterFilters={session:string;status:string;payment:string;refund:string;notice:string;sort:string};
export function rosterFilters(query:Record<string,unknown>):RosterFilters{
 const value=(key:keyof typeof rosterChoices)=>{const choices:readonly(readonly[string,string])[]=rosterChoices[key];return typeof query[key]==='string'&&choices.some(c=>c[0]===query[key])?query[key] as string:key==='sort'?'newest':'';};
 return{session:typeof query.session==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.session)?query.session:'',status:value('status'),payment:value('payment'),refund:value('refund'),notice:value('notice'),sort:value('sort')};
}
export function rosterPath(filters:RosterFilters){const params=new URLSearchParams();for(const[key,value]of Object.entries(filters))if(value&&(key!=='sort'||value!=='newest'))params.set(key,value);return `/admin${params.size?'?'+params:''}#roster`;}
export function rosterReturnPath(raw:unknown){
 if(typeof raw!=='string'||!raw)return '/admin';
 try{const url=new URL(raw,'https://admin.invalid');if(url.origin!=='https://admin.invalid'||url.pathname!=='/admin')return '/admin';return rosterPath(rosterFilters(Object.fromEntries(url.searchParams)));}catch{return '/admin';}
}
export async function queryRoster(db:Awaited<ReturnType<typeof database>>,filters:RosterFilters,sessions:Session[],countOnly=false){
 const completed=sessions.filter(s=>s.completed).map(s=>s.id);
 if(filters.status==='attendance_unknown'&&!completed.length)return {data:[],count:0,error:null};
 let query=db.from('applications').select('*',{count:'exact',head:countOnly});
 if(filters.session)query=query.eq('session_id',filters.session);
 for(const key of ['payment','refund','notice'] as const)if(filters[key])query=filters[key]==='missing'?query.is(key,null):query.eq(key,filters[key]);
 if(filters.status==='current'){if(completed.length)query=query.not('session_id','in',`(${completed.join(',')})`);}
 else if(filters.status==='missing')query=query.is('status',null);
 else if(filters.status==='attendance_unknown')query=query.or('status.eq.active,status.is.null').in('session_id',completed);
 else if(filters.status){query=query.eq('status',filters.status);if(filters.status==='active'&&completed.length)query=query.not('session_id','in',`(${completed.join(',')})`);}

 if(countOnly)return await query;
 const sort=filters.sort==='oldest'?{column:'created_at',ascending:true}:filters.sort==='name'||filters.sort==='name_desc'?{column:'name',ascending:filters.sort==='name'}:filters.sort==='unpaid'?{column:'payment',ascending:false}:filters.sort==='contact'?{column:'notice',ascending:false}:filters.sort==='refund'?{column:'refund',ascending:false}:{column:'created_at',ascending:false};
 query=query.order(sort.column,{ascending:sort.ascending,nullsFirst:false});if(sort.column!=='created_at')query=query.order('created_at',{ascending:false,nullsFirst:false});
 return await query.order('id',{ascending:false}).limit(1000);
}

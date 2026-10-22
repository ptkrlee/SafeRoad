export type BulkOperation='paid'|'cancel'|'contacted';
export type BulkApplication={id:string;session_id:string;people:number;status:string;payment:string;notice:string};
export function bulkEligible(row:BulkApplication,operation:BulkOperation,completedSessionIds:ReadonlySet<string>){
 if(operation==='paid')return row.payment==='unconfirmed';
 if(operation==='contacted')return row.notice!=='contacted';
 return row.status==='active'&&!completedSessionIds.has(row.session_id);
}

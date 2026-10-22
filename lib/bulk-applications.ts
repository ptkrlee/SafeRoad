export type BulkOperation='paid'|'cancel'|'contacted';
export type BulkApplication={id:string;session_id:string;people:number|null;status:string|null;payment:string|null;notice:string|null};
export function bulkEligible(row:BulkApplication,operation:BulkOperation,completedSessionIds:ReadonlySet<string>){
 if(operation==='paid')return row.payment!=='paid';
 if(operation==='contacted')return row.notice!=='contacted';
 return row.status==='active'&&!completedSessionIds.has(row.session_id);
}

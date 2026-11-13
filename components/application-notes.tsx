'use client';
import {useEffect,useRef,useState} from 'react';
import {addApplicationNote,olderApplicationNotes} from '@/app/admin/actions';
import type {ApplicationNoteSummary,ApplicationNotesState} from '@/lib/application-notes';
const shortcuts=['전화 부재','입금 안내 문자 발송','입금 미확인 지속'];
export default function ApplicationNotes({applicationId,summary,state}:{applicationId:string;summary?:ApplicationNoteSummary;state:ApplicationNotesState}){
 const [record,setRecord]=useState({notes:summary?.notes||[],total:summary?.total||0});const [body,setBody]=useState('');const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(false);const [message,setMessage]=useState('');
 const pending=useRef<{body:string;requestId:string}|null>(null);
 useEffect(()=>setRecord({notes:summary?.notes||[],total:summary?.total||0}),[summary]);
 async function save(event:React.FormEvent){event.preventDefault();const text=body.trim();if(busy||!text)return;setBusy(true);setMessage('');
 try{if(pending.current?.body!==text)pending.current={body:text,requestId:crypto.randomUUID()};const result=await addApplicationNote({applicationId,body:text,requestId:pending.current.requestId});if(result.error){setMessage(result.error);return;}if(!result.note){setMessage('저장 결과를 확인하지 못했습니다. 다시 시도해주세요.');return;}const note=result.note;setRecord(current=>current.notes.some(n=>n.id===note.id)?current:{total:current.total+1,notes:[note,...current.notes]});setBody('');pending.current=null;setMessage('메모를 저장했습니다. 입금·연락 상태는 변경하지 않았습니다.');}catch{setMessage('저장 결과를 확인하지 못했습니다. 입력 내용은 유지됩니다. 다시 저장해주세요.');}finally{setBusy(false);}
 }
 async function older(){if(loading||!record.notes.length)return;setLoading(true);setMessage('');try{const result=await olderApplicationNotes({applicationId,before:record.notes[record.notes.length-1].id});if(result.error)setMessage(result.error);else setRecord(current=>({...current,notes:[...current.notes,...(result.notes||[]).filter(note=>!current.notes.some(n=>n.id===note.id))]}));}catch{setMessage('이전 메모를 불러오지 못했습니다. 다시 시도해주세요.');}finally{setLoading(false);}}
 return <details className={`application-notes${record.total?' has-notes':''}`}><summary><span>특이사항·연락 메모{record.total?` ${record.total}건`:''}</span>{record.notes[0]&&<span className="application-note-preview">{record.notes[0].body}</span>}</summary>
 {state==='setup'?<p className="notice">관리자 메모 DB 설치 후 사용할 수 있습니다. <a href="https://raw.githubusercontent.com/ptkrlee/SafeRoad/main/docs/%EA%B4%80%EB%A6%AC%EC%9E%90%EB%A9%94%EB%AA%A8-%EC%84%A4%EC%B9%98.sql" target="_blank" rel="noreferrer">설치 SQL 전체 열기</a></p>:state==='error'?<p className="error">메모를 불러오지 못했습니다. 새로고침 후 확인해주세요. 기존 메모가 없는 것으로 간주하지 마세요.</p>:<>
 <p className="application-note-help">관리자만 보는 기록입니다. 메모 저장은 입금·연락 상태를 바꾸거나 문자를 보내지 않습니다.</p>
 <form onSubmit={save}><label>새 메모<textarea value={body} onChange={event=>setBody(event.target.value)} maxLength={1000} rows={3} required disabled={busy} placeholder="예: 전화했으나 부재. 입금 안내 문자 발송 후 입금 미확인."/></label><div className="application-note-shortcuts">{shortcuts.map(text=><button key={text} type="button" disabled={busy} onClick={()=>setBody(current=>`${current.trim()}${current.trim()?' · ':''}${text}`.slice(0,1000))}>{text}</button>)}</div><div className="application-note-save"><small>{body.length}/1,000자</small><button className="small-button" disabled={busy||!body.trim()}>{busy?'저장 중…':'메모 저장'}</button></div></form>
 <ol className="application-note-list">{record.notes.map(note=><li key={note.id}><time dateTime={note.created_at}>{new Date(note.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</time><p>{note.body}</p></li>)}</ol>{record.total>record.notes.length&&<button type="button" className="small-button" onClick={older} disabled={loading}>{loading?'불러오는 중…':`이전 메모 더 보기 (${record.total-record.notes.length}건)`}</button>}
 </>}{message&&<p role="status" className="application-note-message">{message}</p>}</details>;
}

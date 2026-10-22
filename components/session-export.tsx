'use client';
import {useState} from 'react';
import {formatDate,type Session} from '@/lib/domain';
export default function SessionExport({sessions,initialSessionId=''}:{sessions:Session[];initialSessionId?:string}){
 const [selected,setSelected]=useState(initialSessionId);const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');
 const ordered=[...sessions].sort((a,b)=>a.date.localeCompare(b.date));
 async function download(){if(!selected||busy)return;setBusy(true);setMessage('엑셀 파일을 준비하고 있습니다.');
  try{const response=await fetch(`/admin/export?session=${encodeURIComponent(selected)}`,{cache:'no-store'});
   if(!response.ok){const data=await response.json();throw new Error(data.error||'다운로드하지 못했습니다.');}
   const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`오륙도_신청자명단_${sessions.find(s=>s.id===selected)?.date||'회차'}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('엑셀 파일 다운로드를 시작했습니다. 브라우저 다운로드 목록을 확인해주세요.');
  }catch(error){setMessage(error instanceof Error?error.message:'다운로드하지 못했습니다. 잠시 후 다시 시도해주세요.');}finally{setBusy(false);}
 }
 return <section className="admin-panel"><h3>회차별 신청자 명단 엑셀 다운로드</h3><p>종료 회차도 선택할 수 있습니다. 선택한 현재 참여 회차의 전체 신청 기록을 취소 내역까지 포함해 내려받습니다.</p><div className="filter"><label>다운로드할 회차<select value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);setMessage('');}}><option value="">회차 선택</option>{ordered.map(s=><option key={s.id} value={s.id}>{s.date.slice(0,4)}년 {formatDate(s.date)}{s.completed?' · 운영 종료':s.cancelled?' · 운영 취소':''}</option>)}</select></label><button type="button" className="small-button" disabled={!selected||busy} onClick={download}>{busy?'파일 준비 중…':'엑셀 다운로드 ↓'}</button></div>{message&&<p role="status">{message}</p>}</section>;
}

'use client';
import {useState} from 'react';
import readXlsxFile from 'read-excel-file/browser';
import {parseLegacyRows,type LegacyPreview} from '@/lib/legacy-import';
import {formatDate,type Session} from '@/lib/domain';
import {importApplications} from '@/app/admin/actions';
export default function LegacyImport({sessions,ready}:{sessions:Session[];ready:boolean}){
 const [target,setTarget]=useState(sessions.find(s=>s.date==='2026-11-14')?.id||'');
 const [preview,setPreview]=useState<LegacyPreview|null>(null);const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');
 const session=sessions.find(s=>s.id===target);
 async function load(file?:File){setPreview(null);setMessage('');if(!file||!session)return;
  if(!file.name.toLowerCase().endsWith('.xlsx')||file.size>2*1024*1024){setMessage('2MB 이하의 원본 .xlsx 파일을 선택해주세요.');return;}
  setBusy(true);
  try{const sheets=await readXlsxFile(file);if(sheets.length!==1){setMessage('여러 시트가 있는 파일은 한 시트씩 나누어 가져와주세요.');return;}const values=sheets[0].data;const result=await parseLegacyRows(values,session.date,async value=>{const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join('');});setPreview(result);}
  catch{setMessage('파일을 읽지 못했습니다. 열 구성과 파일 형식을 확인해주세요.');}finally{setBusy(false);}
 }
 async function save(){if(!preview||!session||preview.issues.length||busy)return;setBusy(true);setMessage('');
  try{const result=await importApplications({sessionId:session.id,rows:preview.rows});if(result.error)setMessage(result.error);else{setMessage(`가져오기 완료: 신규 ${result.inserted}건, 기존 중복 ${result.skipped}건. 명단은 새로고침해서 확인해주세요.`);setPreview(null);}}
  catch{setMessage('처리 결과를 확인하지 못했습니다. 같은 파일을 다시 가져와도 이미 등록된 신청은 중복 추가하지 않습니다.');}finally{setBusy(false);}
 }
 return <details className="admin-panel"><summary>기존 네이버폼 신청자 엑셀 가져오기</summary>{!ready?<p className="notice">추가 데이터베이스 설정이 필요합니다. 03-consent-import.sql을 실행한 뒤 새로고침해주세요.</p>:<><p>파일은 이 관리자 화면에서 읽고, 확인한 신청 정보만 저장합니다. 입금은 미확인으로, 입금자명은 원본 미기재로 등록합니다. 기존 동의 응답은 보존하며 새 사진 동의는 기록 없음으로 남깁니다. 입금이나 새 약관 동의를 자동 확인하지 않습니다.</p><div className="login"><label>등록할 회차<select value={target} onChange={e=>{setTarget(e.target.value);setPreview(null);setMessage('');}} disabled={busy}><option value="">회차 선택</option>{sessions.filter(s=>!s.cancelled).map(s=><option key={s.id} value={s.id}>{formatDate(s.date)}</option>)}</select></label><label>네이버폼 원본 엑셀<input key={target} type="file" accept=".xlsx" disabled={!session||busy} onChange={e=>load(e.target.files?.[0])}/></label></div>{preview&&<><p><b>{session&&formatDate(session.date)}에 등록할 신청 {preview.rows.length}건 · 총 {preview.rows.reduce((n,r)=>n+r.people,0)}명</b></p>{preview.issues.length>0&&<div className="error">{preview.issues.map(issue=><p key={issue}>{issue}</p>)}<p>오류를 해결하기 전에는 등록할 수 없습니다.</p></div>}<div className="table-wrap"><table><thead><tr><th>원본 행</th><th>신청자</th><th>연락처</th><th>인원</th><th>사진 동의</th><th>원본 일시</th></tr></thead><tbody>{preview.rows.map(r=><tr key={r.sourceKey}><td>{r.originalRow}</td><td>{r.name}</td><td>{r.phone}</td><td>{r.people}</td><td>기록 없음</td><td>{r.responseModified?'수정된 응답일시':'응답일시'}</td></tr>)}</tbody></table></div><button type="button" className="button" disabled={busy||!preview.rows.length||!!preview.issues.length} onClick={save}>{busy?'처리 중…':`${preview.rows.length}건 가져오기 확정`}</button></>}{message&&<p className="notice" role="status">{message}</p>}</>}</details>;
}

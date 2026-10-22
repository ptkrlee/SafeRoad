'use client';
import {useRouter} from 'next/navigation';
import {confirmedHistory} from '@/lib/confirmed-history';
import {useState} from 'react';
import readXlsxFile from 'read-excel-file/browser';
import {parseLegacyRows,type LegacyPreview} from '@/lib/legacy-import';
import {formatDate,koreaToday,type Session} from '@/lib/domain';
import {importApplications,registerConfirmedHistory} from '@/app/admin/actions';
export default function LegacyImport({sessions,ready,historyReady=false}:{sessions:Session[];ready:boolean;historyReady?:boolean}){
 const router=useRouter();const ordered=[...sessions].filter(s=>!s.cancelled).sort((a,b)=>a.date.localeCompare(b.date));
 const missing=confirmedHistory.filter(h=>!sessions.some(s=>s.date===h.date&&s.completed&&!s.cancelled));
 const [target,setTarget]=useState(sessions.find(s=>s.date==='2026-11-14')?.id||'');
 const [preview,setPreview]=useState<LegacyPreview|null>(null);const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');
 const session=sessions.find(s=>s.id===target);
 async function addHistory(){if(busy)return;setBusy(true);setMessage('');setPreview(null);
  try{const result=await registerConfirmedHistory();setMessage(result.error||`1~5회차 준비 완료: 신규 ${result.added}회차, 완료 처리 ${result.completed}회차. ‘등록할 회차’에서 지난 날짜를 선택해주세요.`);router.refresh();}
  catch{setMessage('결과를 확인하지 못했습니다. 새로고침한 뒤 회차 목록을 확인해주세요.');router.refresh();}finally{setBusy(false);}
 }
 async function load(file?:File){setPreview(null);setMessage('');if(!file||!session)return;
  if(!file.name.toLowerCase().endsWith('.xlsx')||file.size>2*1024*1024){setMessage('2MB 이하의 원본 .xlsx 파일을 선택해주세요.');return;}
  setBusy(true);
  try{const sheets=await readXlsxFile(file);if(sheets.length!==1){setMessage('여러 시트가 있는 파일은 한 시트씩 나누어 가져와주세요.');return;}const values=sheets[0].data;const result=await parseLegacyRows(values,session.date,async value=>{const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join('');});setPreview(result);}
  catch{setMessage('파일을 읽지 못했습니다. 열 구성과 파일 형식을 확인해주세요.');}finally{setBusy(false);}
 }
 async function save(){if(!preview||!session||preview.issues.length||busy)return;setBusy(true);setMessage('');
  try{const result=await importApplications({sessionId:session.id,rows:preview.rows});if(result.error)setMessage(result.error);else{setMessage(`가져오기 완료: 신규 ${result.inserted}건, 기존 중복 ${result.skipped}건. 명단은 새로고침해서 확인해주세요.`);setPreview(null);router.refresh();}}
  catch{setMessage('처리 결과를 확인하지 못했습니다. 같은 파일을 다시 가져와도 이미 등록된 신청은 중복 추가하지 않습니다.');}finally{setBusy(false);}
 }
 return <details className="admin-panel"><summary>기존 네이버폼 신청자 엑셀 가져오기</summary>{!ready?<p className="notice">추가 데이터베이스 설정이 필요합니다. 03-consent-import.sql을 실행한 뒤 새로고침해주세요.</p>:<><p>지난 1~5회차를 포함한 종료 회차도 가져와 통합관리할 수 있습니다. 회차를 선택한 뒤 해당 날짜의 원본 엑셀을 넣어주세요.<br/>파일은 이 관리자 화면에서 읽고, 확인한 신청 정보만 저장합니다. 입금은 미확인으로, 입금자명은 원본 미기재로 등록합니다. 기존 동의 응답은 보존하며 새 사진 동의는 기록 없음으로 남깁니다. 입금·실제 참석·연락 여부나 새 약관 동의를 자동 확인하지 않습니다.</p>{missing.length>0&&<div className="history-import-setup"><strong>기존 1~5회차를 목록에 추가해주세요</strong><p>운영 완료 확인 날짜: 4/25 · 5/9 · 5/30 · 9/19 · 10/3</p>{historyReady?<><button type="button" className="small-button" disabled={busy} onClick={addHistory}>{busy?'처리 중…':'확인된 1~5회차 등록'}</button><small>기존 회차는 중복 생성하지 않습니다. 신청자·입금·개별 참석 기록은 바꾸지 않습니다.</small></>:<p>먼저 <a href="https://github.com/ptkrlee/SafeRoad/blob/main/docs/운영완료-5회차-등록.sql" target="_blank" rel="noopener noreferrer">1~5회차 등록 SQL</a> 전체를 Supabase SQL Editor에서 실행한 뒤 새로고침해주세요. 지난 회차 관리 기능과 5개 날짜가 함께 준비됩니다.</p>}</div>}<div className="login"><label>등록할 회차<select value={target} onChange={e=>{setTarget(e.target.value);setPreview(null);setMessage('');}} disabled={busy}><option value="">회차 선택</option>{ordered.map(s=><option key={s.id} value={s.id}>{s.date.slice(0,4)}년 {formatDate(s.date)}{s.completed?' · 운영 종료':s.date<koreaToday()?' · 지난 일정':''}</option>)}</select></label><label>네이버폼 원본 엑셀<input key={target} type="file" accept=".xlsx" disabled={!session||busy} onChange={e=>load(e.target.files?.[0])}/></label></div>{preview&&<><p><b>{session&&formatDate(session.date)}에 등록할 신청 {preview.rows.length}건 · 총 {preview.rows.reduce((n,r)=>n+r.people,0)}명</b></p>{preview.issues.length>0&&<div className="error">{preview.issues.map(issue=><p key={issue}>{issue}</p>)}<p>오류를 해결하기 전에는 등록할 수 없습니다.</p></div>}<div className="table-wrap"><table><thead><tr><th>원본 행</th><th>신청자</th><th>연락처</th><th>인원</th><th>사진 동의</th><th>원본 일시</th></tr></thead><tbody>{preview.rows.map(r=><tr key={r.sourceKey}><td>{r.originalRow}</td><td>{r.name}</td><td>{r.phone}</td><td>{r.people}</td><td>기록 없음</td><td>{r.responseModified?'수정된 응답일시':'응답일시'}</td></tr>)}</tbody></table></div><button type="button" className="button" disabled={busy||!preview.rows.length||!!preview.issues.length} onClick={save}>{busy?'처리 중…':`${preview.rows.length}건 가져오기 확정`}</button></>}{message&&<p className="notice" role="status">{message}</p>}</>}</details>;
}

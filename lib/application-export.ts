import ExcelJS from 'exceljs';
import type {Session} from './domain';
export type ExportApplication={id:string;original_session_id:string;name:string|null;phone:string|null;address:string|null;people:number|null;depositor:string|null;total:number|null;status:string|null;payment:string|null;payment_review_required?:boolean;refund:string|null;notice:string|null;created_at:string|null;legacy_archive_data?:{sheet:string;originalRow:number;headers:string[];cells:(string|number|boolean|null)[]}|null;source?:string;moved:boolean};
const labels:Record<string,string>={active:'참여 예정',cancelled:'취소',attended:'참석 확인',no_show:'미참석 확인',unconfirmed:'입금 미확인',paid:'입금 확인',none:'환불 해당 없음',pending:'환불 대기',completed:'환불 완료',needed:'안내 필요',contacted:'연락 확인 완료'};
export async function applicationWorkbook(session:Session,rows:ExportApplication[],sessionDates:Map<string,string>){
 const workbook=new ExcelJS.Workbook();workbook.creator='사단법인 부산치유협회';
 const sheet=workbook.addWorksheet('신청자 명단',{views:[{state:'frozen',ySplit:1}]});
 sheet.columns=[
  {header:'번호',key:'number',width:8},{header:'현재 체험일',key:'date',width:15},{header:'최초 체험일',key:'originalDate',width:15},
  {header:'신청자·단체명',key:'name',width:24},{header:'휴대전화',key:'phone',width:20},{header:'주소지',key:'address',width:30},
  {header:'신청 인원',key:'people',width:12},{header:'입금자명',key:'depositor',width:20},{header:'참가비(원)',key:'total',width:16},
  {header:'참여·참석 상태',key:'status',width:25},{header:'입금 상태',key:'payment',width:18},{header:'환불 상태',key:'refund',width:18},
  {header:'연락 상태',key:'notice',width:18},{header:'일정 변경',key:'moved',width:14},{header:'접수 기록(한국시간)',key:'created',width:26},
  {header:'접수 경로',key:'source',width:16},{header:'신청번호',key:'id',width:40},
 ];
 rows.forEach((row,index)=>sheet.addRow({number:index+1,date:session.date,originalDate:sessionDates.get(row.original_session_id)||'기록 확인 필요',name:row.name,phone:row.phone,address:row.address,people:row.people,depositor:row.depositor,total:row.total,status:session.completed&&row.status==='active'?'운영 종료 · 참석 미확인':row.status===null?null:labels[row.status]||row.status,payment:row.payment_review_required?'인원 변경 · 입금 금액 재확인':row.payment===null?null:labels[row.payment]||row.payment,refund:row.refund===null?null:labels[row.refund]||row.refund,notice:row.notice===null?null:labels[row.notice]||row.notice,moved:row.moved?'변경됨':'-',created:row.created_at?new Date(row.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):null,source:row.source==='naver_archive'?'지난 운영자료':row.source==='naver'?'네이버폼':'홈페이지',id:row.id}));
 sheet.autoFilter={from:'A1',to:'Q1'};
 sheet.getColumn('phone').numFmt='@';sheet.getColumn('total').numFmt='#,##0';
 const header=sheet.getRow(1);header.height=28;header.eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF102B24'}};cell.font={bold:true,color:{argb:'FFF5F1E6'}};cell.alignment={vertical:'middle'};});
 sheet.eachRow((row,n)=>{if(n===1)return;row.height=24;row.eachCell(cell=>{cell.font={name:'맑은 고딕',size:11};cell.alignment={vertical:'middle'};if(n%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F5F1'}};});});
 const summary=workbook.addWorksheet('회차 안내');summary.columns=[{width:24},{width:75}];
 summary.addRows([['체험일',session.date],['운영 코스',session.course||'미기재'],['운영 상태',session.completed?'운영 종료':session.cancelled?'운영 취소':'운영 예정'],['신청 건수(취소 포함)',rows.length],['기재된 신청 인원(취소 포함)',rows.reduce((n,r)=>n+(r.people??0),0)],['인원 공란 신청 건수',rows.filter(r=>r.people===null).length],['유의사항','신청 기록을 내보낸 자료입니다. 신청 인원과 실제 참석 인원은 다를 수 있습니다.'],['개인정보','프로그램 운영 목적으로만 이용하고 보유기간에 맞춰 관리해주세요.']]);
 const archiveRows=rows.filter(r=>r.legacy_archive_data);if(archiveRows.length){const raw=workbook.addWorksheet('지난 운영 원본');raw.columns=[{header:'신청번호',width:40},{header:'원본 시트',width:24},{header:'원본 행',width:12},{header:'원본 항목',width:45},{header:'원본 내용',width:55}];for(const row of archiveRows){const data=row.legacy_archive_data!;data.cells.forEach((value,index)=>{if(value!==null&&value!=='')raw.addRow([row.id,data.sheet,data.originalRow,data.headers[index]||`열 ${index+1}`,value]);});}}
 return new Uint8Array(await workbook.xlsx.writeBuffer());
}

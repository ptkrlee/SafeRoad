import { z } from 'zod';
export const legacyRowSchema=z.object({
 responseModified:z.boolean().default(false), sourceKey:z.string().regex(/^[a-f0-9]{64}$/), originalRow:z.number().int().min(2),
 name:z.string().trim().min(2).max(50),address:z.string().trim().min(2).max(100),
 phone:z.string().regex(/^01[016789]\d{7,8}$/), people:z.number().int().min(1).max(30),
 createdAt:z.string().datetime({offset:true}),
 privacyEvidence:z.string().min(1).max(1000),refundEvidence:z.string().min(1).max(1000),
});
export type LegacyRow=z.infer<typeof legacyRowSchema>;
export type LegacyPreview={rows:LegacyRow[];issues:string[];duplicates:number};
function text(value:unknown){return value==null?'':String(value).trim();}
function column(headers:unknown[],parts:string[]){return headers.findIndex(h=>parts.every(p=>text(h).includes(p)));}
export async function parseLegacyRows(values:unknown[][],sessionDate:string,digest:(value:string)=>Promise<string>):Promise<LegacyPreview>{
 const headerIndex=values.findIndex(r=>r.some(c=>text(c).includes('신청자명'))&&r.some(c=>text(c).includes('연락처')));
 if(headerIndex<0)throw new Error('네이버폼의 신청자명·연락처 열을 찾지 못했습니다.');
 const h=values[headerIndex];
 const cols={name:column(h,['신청자명']),address:column(h,['주소지']),phone:column(h,['연락처']),people:column(h,['참여인원']),created:column(h,['응답일시']),privacy:column(h,['개인정보']),refund:column(h,['취소'])};
 if(Object.values(cols).some(v=>v<0))throw new Error('필수 열이 빠져 있습니다. 원본 네이버폼 엑셀인지 확인해주세요.');
 if(values.length-headerIndex-1>500)throw new Error('한 번에 최대 500건까지 가져올 수 있습니다.');
 const rows:LegacyRow[]=[];const issues:string[]=[];const seen=new Set<string>();let duplicates=0;
 for(let i=headerIndex+1;i<values.length;i++){
  const row=values[i];if(row.every(c=>c==null||text(c)===''))continue;
  const originalRow=i+1;
  if(row.some(c=>typeof c==='string'&&c.startsWith('='))){issues.push(`${originalRow}행: 수식이 포함되어 있습니다.`);continue;}
  const name=text(row[cols.name]);let phone=text(row[cols.phone]).replace(/[\s-]/g,'');
  if(/^1[016789]\d{7,8}$/.test(phone))phone='0'+phone;
  const rawDate=row[cols.created];const responseModified=/\s*\(수정\)$/.test(text(rawDate));const dateText=text(rawDate).replace(/\s*\(수정\)$/,'');
  const createdAt=rawDate instanceof Date?rawDate.toISOString():/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(dateText)?dateText.replace(' ','T')+'+09:00':'';
  const privacyEvidence=text(row[cols.privacy]);
  if(!/^(Y|YES|동의|동의함|동의합니다\.?|개인정보 수집 및 이용에 동의합니다\.?)$/i.test(privacyEvidence)){issues.push(`${originalRow}행: 개인정보 동의 응답을 확인해야 합니다.`);continue;}
  const people=Number(row[cols.people]);
  const sourceKey=await digest([sessionDate,createdAt,name,phone,people].join('|'));
  const result=legacyRowSchema.safeParse({sourceKey,responseModified,originalRow,name,address:text(row[cols.address]),phone,people,createdAt,privacyEvidence,refundEvidence:text(row[cols.refund])||'원본 확인 필요'});
  if(!result.success){issues.push(`${originalRow}행: 이름·연락처·인원·응답일시 형식을 확인해주세요.`);continue;}
  const identity=[name,phone].join('|');
  if(seen.has(identity)){duplicates++;issues.push(`${originalRow}행: 같은 이름·연락처가 파일 안에서 중복됩니다. 원본을 확인해주세요.`);continue;}
  seen.add(identity);rows.push(result.data);
 }
 return {rows,issues,duplicates};
}

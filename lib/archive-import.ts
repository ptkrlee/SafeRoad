import {z} from 'zod';
const nullableText=(max:number)=>z.string().max(max).nullable();
export const archiveRowSchema=z.object({
 sourceKey:z.string().regex(/^[a-f0-9]{64}$/),originalRow:z.number().int().min(2),
 name:nullableText(1000),phone:nullableText(1000),address:nullableText(2000),depositor:nullableText(1000),
 people:z.number().int().min(1).max(500).nullable(),total:z.number().int().min(0).max(100000000).nullable(),
 createdAt:z.string().datetime({offset:true}).nullable(),
 status:z.enum(['active','cancelled','attended','no_show']).nullable(),payment:z.enum(['paid','unconfirmed']).nullable(),
 refund:z.enum(['none','pending','completed']).nullable(),notice:z.enum(['needed','contacted']).nullable(),
 privacyEvidence:nullableText(4000),refundEvidence:nullableText(4000),responseModified:z.boolean(),
 original:z.object({sheet:z.string().max(200),headers:z.array(z.string().max(4000)).max(100),cells:z.array(z.union([z.string(),z.number(),z.boolean(),z.null()])).max(100)}),
});
export type ArchiveRow=z.infer<typeof archiveRowSchema>;
export type ArchivePreview={rows:ArchiveRow[];issues:string[];summaryRows:number;emptyRows:number;duplicates:number};
const text=(v:unknown)=>v==null?'':v instanceof Date?v.toISOString():String(v).trim();
const clean=(v:unknown)=>text(v)||null;
const label=(v:unknown)=>text(v).replace(/\s+/g,'');
const numeric=(v:unknown)=>{if(v==null||text(v)==='')return null;const n=Number(text(v).replace(/명$/,''));return Number.isInteger(n)&&n>=1&&n<=500?n:null;};
function originalDate(v:unknown){
 if(!v)return null;
 const value=v instanceof Date?v.toISOString().replace(/\.000Z$/,'+09:00'):text(v).replace(/\s*\(수정\)$/,'');
 if(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d)?$/.test(value))return value.replace(' ','T')+(value.length===16?':00':'')+'+09:00';
 if(/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value)))return value;
 return null;
}
function phoneValue(v:unknown){
 if(v==null||text(v)==='')return null;
 let digits=text(v).replace(/\D/g,'');if(/^1[016789]\d{7,8}$/.test(digits))digits='0'+digits;
 return /^01[016789]\d{7,8}$/.test(digits)?digits:text(v);
}
function paymentValue(values:unknown[],people:number|null):ArchiveRow['payment']{
 const present=values.map(v=>text(v)).filter(Boolean);if(!present.length)return null;
 if(present.some(v=>/^(O|○|ㅇ|Y|YES|입금완료|입금확인|완납)$/i.test(v)))return 'paid';
 if(people!==null&&present.some(v=>/^\d+$/.test(v)&&Number(v)===people))return 'paid';
 if(present.every(v=>/^(0|X|미입금|입금미확인)$/i.test(v)))return 'unconfirmed';
 return null;
}
function isSummary(value:unknown){const v=label(value);return /^(?:(?:전체|총)?신청(?:인원|자|자수)?(?:계|소계|합계)?|중복\/취소|(?:취소|불참)(?:\(불참\))?(?:인원)?(?:계|합계)?|참석(?:인원)?합계|총계|합계|최종참여인원)$/.test(v);}
export async function parseArchiveSheets(sheets:{sheet:string;data:unknown[][]}[],sessionDate:string,digest:(value:string)=>Promise<string>):Promise<ArchivePreview>{
 const result:ArchivePreview={rows:[],issues:[],summaryRows:0,emptyRows:0,duplicates:0};const seen=new Set<string>();
 for(const sheet of sheets){
  const headerIndex=sheet.data.findIndex(r=>r.some(c=>label(c).includes('신청자명')||/^(성명|이름)$/.test(label(c))));
  if(headerIndex<0){result.issues.push(`${sheet.sheet}: 신청자명 열을 찾지 못했습니다. 자료는 등록하지 않았습니다.`);continue;}
  const headers=sheet.data[headerIndex].map(text);const find=(re:RegExp)=>headers.findIndex(h=>re.test(label(h)));
  const cols={name:find(/신청자명|^(성명|이름)$/),phone:find(/연락처|휴대전화|전화번호/),address:find(/주소지|^주소$/),people:find(/참여인원|참가인원/),created:find(/응답일시|신청일시/),privacy:find(/개인정보/),refundPolicy:find(/취소.*정책|환불.*정책/),depositor:find(/입금자/),total:find(/^총참가비$|^참가비금액$|^금액$/)};
  const operational=headers.map((h,i)=>({h:label(h),i})).filter(c=>c.i!==cols.refundPolicy&&c.i!==cols.privacy&&(/출석|참석|입금|환불|비고|메모|이후/.test(c.h)||!c.h));
  for(let i=headerIndex+1;i<sheet.data.length;i++){
   const row=sheet.data[i];if(row.every(v=>!text(v))){result.emptyRows++;continue;}
   if(isSummary(row[cols.name])||!clean(row[cols.name])&&row.some(v=>isSummary(v))){result.summaryRows++;continue;}
   if(!clean(row[cols.name])&&!clean(row[cols.phone])){result.issues.push(`${sheet.sheet} ${i+1}행: 신청 행인지 확인이 필요합니다. 누락 방지를 위해 자동 등록하지 않습니다.`);continue;}
   const people=numeric(row[cols.people]);const operations=operational.map(c=>row[c.i]);
   const evidence=operations.map(text);const attendance=headers.flatMap((h,j)=>/출석|참석/.test(h)?[text(row[j])]:[]);
   const status=evidence.some(v=>/취소/.test(v))?'cancelled':evidence.some(v=>/불참|미참석/.test(v))?'no_show':attendance.some(v=>/^(O|○|참석|출석|참석완료)$/i.test(v))?'attended':null;
   const createdAt=originalDate(row[cols.created]);
   const cells=Array.from({length:Math.max(headers.length,row.length)},(_,j)=>{const v=row[j];return v==null?null:v instanceof Date?v.toISOString():typeof v==='number'||typeof v==='boolean'?v:String(v);});
   const original={sheet:sheet.sheet,headers,cells};const sourceKey=await digest(JSON.stringify(['archive-v1',sessionDate,i+1,original]));
   if(seen.has(sourceKey)){result.duplicates++;continue;}seen.add(sourceKey);
   const rawTotal=cols.total<0?null:row[cols.total];const total=rawTotal!=null&&text(rawTotal)!==''&&Number.isInteger(Number(rawTotal))&&Number(rawTotal)>=0?Number(rawTotal):null;
   const payment=paymentValue(operational.filter(c=>/입금|이후/.test(c.h)).map(c=>row[c.i]),people);
   const parsed=archiveRowSchema.safeParse({sourceKey,originalRow:i+1,name:clean(row[cols.name]),address:clean(row[cols.address]),phone:phoneValue(row[cols.phone]),people,depositor:clean(row[cols.depositor]),total,createdAt,status,payment,refund:evidence.some(v=>/환불\s*완료/.test(v))?'completed':null,notice:null,privacyEvidence:clean(row[cols.privacy]),refundEvidence:clean(row[cols.refundPolicy]),responseModified:/\(수정\)/.test(text(row[cols.created])),original});
   if(!parsed.success){result.issues.push(`${sheet.sheet} ${i+1}행: 저장 가능한 범위와 형식을 확인해주세요. 원본 행은 보존되며 자동으로 제외하지 않습니다.`);continue;}
   result.rows.push(parsed.data);
  }
 }
 if(result.rows.length>500)result.issues.push('한 번에 최대 500개 신청 행까지 가져올 수 있습니다.');
 return result;
}

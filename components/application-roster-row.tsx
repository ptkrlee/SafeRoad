'use client';

import {useState,type ReactNode} from 'react';

/** Keep the desktop table, with an independently expandable summary on phones. */
export default function ApplicationRosterRow({name,summary,children}:{name:string;summary:ReactNode;children:ReactNode}) {
 const [expanded,setExpanded]=useState(false);
 return <tr className={`roster-row${expanded?' is-expanded':''}`}>
  {children}
  <td className="roster-mobile-summary" colSpan={6}>
   {summary}
   <button type="button" className="roster-expand" aria-expanded={expanded} aria-label={`${name} 상세정보 및 처리 ${expanded?'접기':'펼치기'}`} onClick={()=>setExpanded(value=>!value)}>{expanded?'접기 ▴':'상세 ▾'}</button>
  </td>
 </tr>;
}

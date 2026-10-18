export const officeContact='사무국(010-9679-9817, 문자 연락)';
export function withOfficeContact(text:string){return text.replace(/사무국(?!\s*\()/g,officeContact);}

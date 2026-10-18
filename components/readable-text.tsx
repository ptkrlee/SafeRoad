import {withOfficeContact} from '@/lib/contact';
export default function ReadableText({text}:{text:string}){const sentences=withOfficeContact(text).split(/(?<=[.!?])\s+|\n+/);for(let i=sentences.length-2;i>=0;i--){if(sentences[i].length<10)sentences.splice(i,2,sentences[i]+' '+sentences[i+1]);}return <>{sentences.map((sentence,i)=><span className="sentence" key={i}>{sentence}</span>)}</>;}

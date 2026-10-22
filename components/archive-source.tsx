export type ArchiveSourceData={sheet:string;originalRow:number;headers:string[];cells:(string|number|boolean|null)[]};
export default function ArchiveSource({data}:{data:ArchiveSourceData|null|undefined}){
 if(!data)return null;
 return <details className="archive-source"><summary>원본 운영 기록 · {data.originalRow}행</summary><dl>{data.cells.map((value,index)=>value===null||value===''?null:<div key={index}><dt>{data.headers[index]||`열 ${index+1}`}</dt><dd>{String(value)}</dd></div>)}</dl></details>;
}

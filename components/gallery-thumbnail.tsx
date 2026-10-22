'use client';
import {useState} from 'react';
export default function GalleryThumbnail({id,caption}:{id:string;caption:string}){
 const[failed,setFailed]=useState(false);
 return failed?<span className="gallery-thumb-missing">미리보기<br/>없음</span>:<img className="gallery-admin-thumb" src={`/admin/gallery/${id}/preview`} alt={caption||'업로드한 사진 미리보기'} width={56} height={42} loading="lazy" onError={()=>setFailed(true)}/>;
}

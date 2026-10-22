import ProgramIcon from '@/components/program-icon';
export default function GalleryEmpty({title,description='게시된 체험 사진은 이곳에서 확인하실 수 있습니다.'}:{title:string;description?:string}){
 return <div className="empty gallery-empty"><span className="gallery-empty-icon" aria-hidden="true"><ProgramIcon name="rest"/></span><h2>{title}</h2><p>{description}</p></div>;
}

import CoastalHeading from '@/components/coastal-heading';
import ParticipantApplicationEditor from '@/components/participant-application-editor';
import {publicData} from '@/lib/data';
import {applicationEditConfigured} from '@/lib/application-edit-server';
export const dynamic='force-dynamic';
export const metadata={title:'신청내역 확인·변경 | 오륙도 안전걷기로드',robots:{index:false,follow:false}};
export default async function ApplicationEdit(){const data=await publicData();return <main className="section public-page application-edit-page"><CoastalHeading><p className="eyebrow">MANAGE YOUR WALK</p><h1>신청내역 확인·변경</h1><p>신청하신 내용을 확인하고, 바뀐 정보를 알려주세요.</p></CoastalHeading><ParticipantApplicationEditor ready={data.settings.application_edit_ready===true&&applicationEditConfigured()}/></main>;}

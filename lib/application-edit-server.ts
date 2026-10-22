import 'server-only';
import {createClient} from '@supabase/supabase-js';
export function applicationEditConfigured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY);}
export function applicationEditDatabase(){if(!applicationEditConfigured())throw new Error('EDIT_SETUP_REQUIRED');return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});}
export function applicationEditError(code?:string){
 if(code?.includes('INVALID_ACCESS'))return '변경용 인증이 만료되었거나 비밀번호가 재설정되었습니다. 전화번호와 비밀번호로 다시 조회해주세요.';
 if(code?.includes('STALE_EDIT'))return '다른 곳에서 수정된 신청입니다. 새로 조회한 뒤 다시 수정해주세요.';
 if(code?.includes('CAPACITY'))return '잔여 정원이 부족합니다. 인원을 확인하거나 사무국에 문의해주세요.';
 if(code?.includes('AMOUNT_CONFIRM'))return '인원 변경에 따른 참가비와 입금·환불 확인 안내에 체크해주세요.';
 if(code?.includes('EDIT_CLOSED'))return '종료·취소되었거나 체험이 시작된 신청입니다. 변경은 사무국(010-9679-9817, 문자 연락)에 문의해주세요.';
 if(code?.includes('PEOPLE_LOCKED'))return '취소 또는 환불 처리 중인 신청은 인원을 직접 변경할 수 없습니다. 사무국에 문의해주세요.';
 if(code?.includes('DUPLICATE'))return '같은 회차에 동일한 이름·전화번호의 신청이 있습니다. 사무국에 확인해주세요.';
 return '저장하지 못했습니다. 입력 내용·정원·최신 신청 상태를 확인하고 다시 시도해주세요.';
}

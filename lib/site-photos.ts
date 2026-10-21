export type SitePhoto={src:string;alt:string;caption:string;position?:string;width:number;height:number};
const photo=(file:string,alt:string,caption:string,width:number,height:number,position='50% 50%'):SitePhoto=>({src:`/images/program/${file}-original.webp`,alt,caption,width,height,position});
export const programPhotos={
 main:photo('coast-overlook','이기대에서 바라본 오륙도와 해안 산책길','이기대에서 만나는 오륙도',880,586,'50% 58%'),
 taping:photo('taping-complete','무릎에 안전걷기 테이핑을 마친 모습','안전걷기 테이핑',861,579,'50% 52%'),
 walking:photo('coastal-walk','안내자와 함께 이기대 숲길을 걷는 참가자들','바른자세 걷기',553,576,'50% 46%'),
 recovery:photo('massage-gun','마사지건으로 다리 근육을 돌보는 자가회복 체험','자가회복 프로그램',412,283),
 namparang:photo('coastal-scenery','이기대 해안의 바위와 바다 풍경','바닷길을 따라 만나는 풍경',883,582),
};
// Start with the requested main view, then show the remaining supplied activity photos.
export const heroPhotos:SitePhoto[]=[
 programPhotos.main,
 photo('welcome-center','바다 곁 오륙도 홍보관 입구','우리의 걷기가 시작되는 곳',879,589),
 photo('registration','체험 참가를 등록하는 현장','반가운 인사로 시작하는 하루',844,561),
 photo('safety-briefing','참가자들과 함께하는 사전 안전교육','안전을 먼저 배우는 시간',876,590),
 photo('warmup','걷기에 앞서 함께 준비운동하는 참가자들','함께 몸을 풀고, 걸을 준비',804,520),
 photo('taping-guidance','전문가 안내에 따라 테이핑을 체험하는 모습','내 몸을 살피는 작은 준비',877,589),
 photo('taping-together','참가자가 직접 테이핑을 연습하는 모습','나를 위한 테이핑을 배워요',703,579),
 photo('taping-practice','무릎 테이핑을 준비하는 참가자들','하나씩 익혀가는 안전한 습관',687,583),
 photo('photo-point','남파랑길과 해파랑길이 만나는 곳의 포토존','바다 곁에서 남기는 한 장',871,590),
 photo('coastal-group','바다 앞에서 함께 기념사진을 찍는 참가자들','함께 걸어서 더 특별한 순간',875,565),
 photo('souvenirs','참가자에게 준비한 물과 체험 물품','정성껏 준비한 체험의 작은 것들',870,584),
];

import {rosterFilters} from './admin-application-filters';
/** Counts and shortcuts share exactly the same filters. */
export const adminMetricPresets=[
 {label:'입금 확인 대기',filters:rosterFilters({status:'active',payment:'unconfirmed',sort:'unpaid'})},
 {label:'안내 필요',filters:rosterFilters({status:'current',notice:'needed',sort:'contact'})},
 {label:'환불 대기',filters:rosterFilters({refund:'pending',sort:'refund'})},
];

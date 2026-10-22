import SiteLink from '@/components/site-link';
import {adminMetricPresets} from '@/lib/admin-metrics';
import {rosterPath} from '@/lib/admin-application-filters';
export default function AdminMetrics({counts}:{counts:number[]}){
 return <div className="metrics">{adminMetricPresets.map((metric,index)=><div key={metric.label}><SiteLink href={rosterPath(metric.filters)} aria-label={`${metric.label} ${counts[index]}건 명단 보기`}><span>{metric.label}</span><strong>{counts[index]}건</strong><small>명단 보기 ↗</small></SiteLink></div>)}</div>;
}

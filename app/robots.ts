import type {MetadataRoute} from 'next';
import {siteUrl,isPreview} from '@/lib/seo';
export default function robots():MetadataRoute.Robots{
 return isPreview?{rules:{userAgent:'*',disallow:'/'}}:{rules:{userAgent:'*',allow:'/',disallow:'/api/'},sitemap:`${siteUrl}/sitemap.xml`};
}

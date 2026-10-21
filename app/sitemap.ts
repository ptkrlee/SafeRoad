import type {MetadataRoute} from 'next';
import {siteUrl} from '@/lib/seo';
export default function sitemap():MetadataRoute.Sitemap{
 return ['','/guide','/gallery'].map(path=>({url:`${siteUrl}${path}`}));
}

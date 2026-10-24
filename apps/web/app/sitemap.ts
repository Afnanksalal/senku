import type { MetadataRoute } from 'next';
import { publicIndexingEnabled,publicRoutes,siteOrigin } from '../lib/seo';
export default function sitemap():MetadataRoute.Sitemap {
  return publicIndexingEnabled?publicRoutes.map(path=>({url:`${siteOrigin}${path}`,changeFrequency:'weekly',priority:path==='/'?1:path==='/welcome'?.9:.7})):[];
}

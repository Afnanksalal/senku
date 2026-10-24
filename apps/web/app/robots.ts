import type { MetadataRoute } from 'next';
import { publicIndexingEnabled,siteOrigin } from '../lib/seo';
export default function robots():MetadataRoute.Robots {
  return publicIndexingEnabled?{
    rules:{userAgent:'*',allow:'/',disallow:['/backend/','/api/','/home','/profile','/rooms','/shared','/classroom','/companion','/pathways','/offline','/discover/']},
    sitemap:`${siteOrigin}/sitemap.xml`,host:siteOrigin,
  }:{rules:{userAgent:'*',disallow:'/'}};
}

import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';
export const metadata=pageMetadata("Shared experiment","A private Senku resource shared through an access link.","/shared",true);
export default function Layout({children}:{children:ReactNode}){return children;}

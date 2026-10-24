import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';
export const metadata=pageMetadata("Your learning home","Your learning progress, saved work and next science mission.","/home",true);
export default function Layout({children}:{children:ReactNode}){return children;}

import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';
export const metadata=pageMetadata('Molecular docking','Explore how a small molecule fits a teaching protein. Compare estimated poses with a deposited crystal structure.','/docking',false);
export default function Layout({children}:{children:ReactNode}){return children;}

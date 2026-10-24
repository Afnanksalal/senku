import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';
export const metadata=pageMetadata("Welcome to Senku","Follow your curiosity into personal science missions, playful biology experiments and three-dimensional discoveries with Senku.","/welcome",false);
export default function Layout({children}:{children:ReactNode}){return children;}

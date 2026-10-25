import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';
export const metadata = pageMetadata('Your molecular workspace', 'Draw small molecules, keep private collections and compare their estimated fits in curated protein pockets.', '/molecules');
export default function Layout({ children }: { children: ReactNode }) { return children; }

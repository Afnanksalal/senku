import type { ReactNode } from 'react';
export const metadata = { title: 'Senku', description: 'Science experimentation platform' };
export default function Layout({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html>; }

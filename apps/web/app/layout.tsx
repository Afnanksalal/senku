import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Caveat, Nunito } from 'next/font/google';
import { AppHeader } from '../components/AppHeader';
import { Providers } from './providers';
import './globals.css';
import { rootMetadata, structuredData } from '../lib/seo';
import { PwaManager } from '../components/PwaManager';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Nunito({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const hand = Caveat({ subsets: ['latin'], variable: '--font-hand', display: 'swap', weight: ['500', '700'] });

export const metadata: Metadata = {...rootMetadata,manifest:'/manifest.webmanifest',appleWebApp:{capable:true,statusBarStyle:'default',title:'Senku'},icons:{icon:[{url:'/icons/icon-192.png',sizes:'192x192',type:'image/png'},{url:'/icons/icon-512.png',sizes:'512x512',type:'image/png'}],apple:[{url:'/icons/apple-touch-icon.png',sizes:'180x180',type:'image/png'}]}};
export const viewport: Viewport = { themeColor: '#e9efe8', width: 'device-width', initialScale: 1 };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${hand.variable}`}>
      <body>
        <Providers>
          <a href="#main" className="skip">Skip to content</a>
          <AppHeader />
          <PwaManager />
          <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData()).replace(/</g,'\\u003c')}} />
          <main id="main">{children}</main>
        </Providers>
      </body>
    </html>
  );
}

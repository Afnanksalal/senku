import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Caveat, Nunito } from 'next/font/google';
import { AppHeader } from '../components/AppHeader';
import { Providers } from './providers';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Nunito({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const hand = Caveat({ subsets: ['latin'], variable: '--font-hand', display: 'swap', weight: ['500', '700'] });

export const metadata: Metadata = {
  title: { default: 'Senku', template: '%s | Senku' },
  description: 'Predict, run and explain real biology experiments, then take them into the lab.',
};
export const viewport: Viewport = { themeColor: '#e9efe8', width: 'device-width', initialScale: 1 };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${hand.variable}`}>
      <body>
        <Providers>
          <a href="#main" className="skip">Skip to content</a>
          <AppHeader />
          <main id="main">{children}</main>
        </Providers>
      </body>
    </html>
  );
}

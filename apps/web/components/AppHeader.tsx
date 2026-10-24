'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from '../lib/session';
import { useUsage } from '../lib/runs';
import { AccountDialog } from './AccountDialog';
import { BrandMark, Glyph } from './Glyph';

export function AppHeader() {
  const path = usePathname();
  const user = useSession((s) => s.user);
  const usage = useUsage();
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const signedIn = hydrated && user && user.role !== 'guest';
  const admitted = !!usage.data?.member?.active;

  return (
    <header className="topbar glass spread">
      <div className="row header-nav" style={{ gap: '1.25rem' }}>
        <Link href="/" className="brand"><BrandMark />Senku</Link>
      </div>
      <div className="row header-account" style={{ gap: '.5rem' }}>
        {signedIn && (
          <span className="chip tone hide-sm" data-stain={admitted ? 'chlorophyll' : 'pollen'}>
            <Glyph name="server" size={15} />{admitted ? 'Lab server access' : 'No lab server access yet'}
          </span>
        )}
        <button className="btn quiet small account-trigger" onClick={() => setOpen(true)} aria-label={signedIn ? `Account: ${user.display_name}` : 'Sign in'}>
          <Glyph name="person" size={18} />
          <span>{signedIn ? user.display_name : 'Sign in'}</span>
        </button>
      </div>
      <nav aria-label="Main" className="app-nav">
        {[
          ['/', 'Explore'], ['/learn', 'Learn'], ['/lab', 'Lab'], ['/challenges', 'Play'],
          ['/discover', 'Research'], ['/companion', 'Ask Senku'], ['/pathways', 'Pathways'], ['/rooms', 'Shared labs'], ['/classroom','Classroom'], ['/offline','Offline'],
        ].map(([href, name]) => <Link key={href} href={href} className="nav-link" aria-current={(href === '/' ? path === '/' : path.startsWith(href)) ? 'page' : undefined}>{name}</Link>)}
      </nav>
      <AccountDialog open={open} onOpenChange={setOpen} />
    </header>
  );
}

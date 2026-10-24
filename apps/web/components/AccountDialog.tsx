'use client';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useSession, type AuthResponse } from '../lib/session';
import { useUsage } from '../lib/runs';
import { Glyph } from './Glyph';

const form = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; };
const message = (e: unknown) => e instanceof ApiError ? e.message : 'Something went wrong. Try again.';

export function AccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const user = useSession((s) => s.user);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog glass stack loose">
          <div className="spread">
            <Dialog.Title asChild><h2>{user && user.role !== 'guest' ? 'Your account' : 'Save your science'}</h2></Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label="Close"><Glyph name="close" /></Dialog.Close>
          </div>
          {user && user.role !== 'guest' ? <Profile onDone={() => onOpenChange(false)} /> : <SignIn onDone={() => onOpenChange(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SignIn({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const signIn = useSession((s) => s.signIn);
  const done = (auth: AuthResponse) => { signIn(auth); void qc.invalidateQueries(); onDone(); };
  const login = useMutation({ mutationFn: (b: Record<string, string>) => api<AuthResponse>('/v1/auth/login', { method: 'POST', body: b }), onSuccess: done });
  // Registering from a guest session upgrades it in place, so nothing the guest did is lost.
  const register = useMutation({ mutationFn: (b: Record<string, string>) => api<AuthResponse>('/v1/auth/register', { method: 'POST', body: b, auth: true }), onSuccess: done });

  return (
    <Tabs.Root defaultValue="login" className="stack">
      <Dialog.Description className="muted">An account keeps your runs and lets you use the lab server once you have an invitation. You can keep exploring as a guest.</Dialog.Description>
      <Tabs.List className="tabs" aria-label="Account">
        <Tabs.Trigger value="login">Sign in</Tabs.Trigger>
        <Tabs.Trigger value="register">Create account</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="login">
        <form className="stack" onSubmit={(e) => login.mutate(form(e))}>
          <label className="field"><span>Email</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
          <label className="field"><span>Password</span><input className="input" name="password" type="password" autoComplete="current-password" minLength={12} required /></label>
          {login.error && <p role="alert" className="notice alert">{message(login.error)}</p>}
          <button className="btn" disabled={login.isPending}>{login.isPending ? 'Signing in' : 'Sign in'}</button>
        </form>
      </Tabs.Content>
      <Tabs.Content value="register">
        <form className="stack" onSubmit={(e) => register.mutate(form(e))}>
          <label className="field"><span>Name</span><input className="input" name="display_name" autoComplete="nickname" maxLength={80} required /></label>
          <label className="field"><span>Email</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
          <label className="field"><span>Password</span><input className="input" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required aria-describedby="pw-hint" /></label>
          <p id="pw-hint" className="faint">At least 12 characters.</p>
          {register.error && <p role="alert" className="notice alert">{message(register.error)}</p>}
          <button className="btn" disabled={register.isPending}>{register.isPending ? 'Creating account' : 'Create account'}</button>
        </form>
      </Tabs.Content>
    </Tabs.Root>
  );
}

function Profile({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const user = useSession((s) => s.user)!;
  const signOut = useSession((s) => s.signOut);
  const usage = useUsage();
  const progress = useQuery({
    queryKey: ['progress', user.id],
    queryFn: () => api<{ xp: number; streak: { days: number }; lessons: unknown[]; achievements: unknown[] }>('/v1/me/progress', { auth: true }),
  });
  const [code, setCode] = useState('');
  const redeem = useMutation({
    mutationFn: () => api('/v1/invitations/redeem', { method: 'POST', auth: true, body: { code: code.trim() } }),
    onSuccess: () => { setCode(''); void qc.invalidateQueries({ queryKey: ['usage'] }); },
  });
  const logout = useMutation({
    mutationFn: () => api('/v1/auth/logout', { method: 'POST', auth: true, body: { all_sessions: false } }),
    onSettled: () => { signOut(); qc.clear(); onDone(); },
  });
  const member = usage.data?.member;
  const used = usage.data?.usage.filter((u) => u.state !== 'released').reduce((s, u) => s + u.units, 0) ?? 0;

  return (
    <div className="stack">
      <Dialog.Description className="muted">Signed in as <strong>{user.display_name}</strong>{user.email ? ` (${user.email})` : ''}.</Dialog.Description>
      <section className="solid panel stack snug" aria-labelledby="compute">
        <h3 id="compute">Lab server access</h3>
        {usage.isLoading ? <p className="faint">Checking access</p>
          : usage.error ? <p className="notice alert">{message(usage.error)}</p>
          : member ? (
            <p>You&apos;re in <strong>{member.name}</strong>. Today you&apos;ve used <strong className="num">{used}</strong> of <strong className="num">{member.member_daily_units}</strong> runs. Allowances reset daily at 00:00 UTC.</p>
          ) : (
            <form className="stack snug" onSubmit={(e) => { e.preventDefault(); redeem.mutate(); }}>
              <p className="muted">Server runs are invitation-only. Paste the code you were given.</p>
              <label className="field"><span>Invitation code</span>
                <input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} pattern="[A-Za-z0-9_\-]{43}" title="43 letters, numbers, dashes or underscores" required spellCheck={false} autoComplete="off" />
              </label>
              {redeem.error && <p role="alert" className="notice alert">{message(redeem.error)}</p>}
              <button className="btn hema" disabled={redeem.isPending}>{redeem.isPending ? 'Checking code' : 'Redeem invitation'}</button>
            </form>
          )}
      </section>
      <section className="solid panel stack snug" aria-labelledby="progress">
        <h3 id="progress">Your progress</h3>
        {progress.isLoading ? <p className="faint">Loading progress</p>
          : progress.error ? <p className="notice alert">{message(progress.error)}</p>
          : progress.data && (
            <dl className="kv">
              <dt>XP</dt><dd className="num">{progress.data.xp}</dd>
              <dt>Streak</dt><dd className="num">{progress.data.streak.days} day{progress.data.streak.days === 1 ? '' : 's'}</dd>
              <dt>Missions completed</dt><dd className="num">{progress.data.lessons.length}</dd>
              <dt>Achievements</dt><dd className="num">{progress.data.achievements.length}</dd>
            </dl>
          )}
      </section>
      <button className="btn quiet" onClick={() => logout.mutate()} disabled={logout.isPending}>Sign out</button>
    </div>
  );
}

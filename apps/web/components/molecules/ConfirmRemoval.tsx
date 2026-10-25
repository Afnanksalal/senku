'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { useRef } from 'react';
import { Glyph } from '../Glyph';
import s from '../../app/molecules/molecules.module.css';
export type RemovalRequest = { title: string; description: string; label: string; confirm: () => void; returnTo: HTMLElement | null };
export function ConfirmRemoval({ request, onClose }: { request: RemovalRequest | null; onClose: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  if (request) returnTo.current = request.returnTo;
  return <Dialog.Root open={!!request} onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="overlay"/><Dialog.Content role="alertdialog" className={`dialog glass ${s.confirmDialog}`} onOpenAutoFocus={event => { event.preventDefault(); cancel.current?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); returnTo.current?.focus(); }}>
    <div className={s.sectionHeading}><Dialog.Title asChild><h2>{request?.title}</h2></Dialog.Title><Dialog.Close className="icon-btn" aria-label="Close confirmation"><Glyph name="close"/></Dialog.Close></div>
    <Dialog.Description>{request?.description}</Dialog.Description>
    <div className={s.confirmActions}><button className="btn quiet" ref={cancel} onClick={onClose}>Keep it</button><button className={`btn ${s.danger}`} onClick={() => { const action = request?.confirm; onClose(); action?.(); }}>{request?.label ?? 'Remove'}</button></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

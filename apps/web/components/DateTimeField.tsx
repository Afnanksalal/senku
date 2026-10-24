'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Glyph } from './Glyph';
import styles from './DateTimeField.module.css';

type Props = { value: string; onChange: (value: string) => void; label: string; disabled?: boolean };
const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromKey = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const prettyDate = (date: Date) => date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Optional local date/time, with no native calendar or time-picker UI. */
export function DateTimeField({ value, onChange, label, disabled }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [time, setTime] = useState('17:00');
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [focused, setFocused] = useState(() => dateKey(new Date()));
  const [error, setError] = useState('');
  const focusRequested = useRef(false);
  useEffect(() => {
    if (!focusRequested.current) return;
    focusRequested.current = false;
    document.getElementById(`${id}-${focused}`)?.focus();
  }, [focused, month, id]);
  const changeOpen = (next: boolean) => {
    if (next) {
      const parsed = value ? new Date(value) : new Date();
      const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
      setSelected(value ? dateKey(date) : '');
      setFocused(dateKey(date)); setMonth(monthStart(date));
      setTime(value && timePattern.test(value.slice(11, 16)) ? value.slice(11, 16) : '17:00');
      setError('');
    }
    setOpen(next);
  };
  const navigate = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next); setFocused(dateKey(next));
  };
  const onDayKey = (event: KeyboardEvent<HTMLButtonElement>, day: Date) => {
    const next = new Date(day);
    let handled = true;
    if (event.key === 'ArrowLeft') next.setDate(next.getDate() - 1);
    else if (event.key === 'ArrowRight') next.setDate(next.getDate() + 1);
    else if (event.key === 'ArrowUp') next.setDate(next.getDate() - 7);
    else if (event.key === 'ArrowDown') next.setDate(next.getDate() + 7);
    else if (event.key === 'Home') next.setDate(next.getDate() - next.getDay());
    else if (event.key === 'End') next.setDate(next.getDate() + 6 - next.getDay());
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const target = new Date(next.getFullYear(), next.getMonth() + (event.key === 'PageDown' ? 1 : -1), 1);
      next.setFullYear(target.getFullYear(), target.getMonth(), Math.min(day.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()));
    } else handled = false;
    if (handled) { event.preventDefault(); focusRequested.current = true; setMonth(monthStart(next)); setFocused(dateKey(next)); }
  };
  const first = new Date(month); first.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const day = new Date(first); day.setDate(first.getDate() + i); return day; });
  const today = dateKey(new Date());
  const shown = value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Choose date and time';
  return <Dialog.Root open={open} onOpenChange={changeOpen}>
    <Dialog.Trigger asChild><button type="button" className={styles.trigger} disabled={disabled} aria-label={`${label}: ${value ? shown : 'not set'}`}><span>{shown}</span><Glyph name="next" size={16}/></button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className={styles.overlay}/>
      <Dialog.Content className={styles.content} onOpenAutoFocus={event => { event.preventDefault(); requestAnimationFrame(() => document.getElementById(`${id}-${focused}`)?.focus()); }}>
        <div className={styles.heading}><div><Dialog.Title asChild><h2>Choose a due date</h2></Dialog.Title><Dialog.Description className="faint">Optional, in your browser’s local time.</Dialog.Description></div><Dialog.Close className="icon-btn" aria-label="Close due-date picker"><Glyph name="close"/></Dialog.Close></div>
        <form noValidate className="stack snug" onSubmit={event => {
          event.preventDefault();
          event.stopPropagation();
          if (!selected) { setError('Choose a date, or select No due date.'); return; }
          if (!timePattern.test(time)) { setError('Enter a 24-hour time such as 17:00.'); return; }
          onChange(`${selected}T${time}`); setOpen(false);
        }}>
          <div className={styles.monthNav}><button type="button" className="icon-btn" aria-label="Previous month" onClick={() => navigate(-1)}><Glyph name="back"/></button><strong aria-live="polite">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong><button type="button" className="icon-btn" aria-label="Next month" onClick={() => navigate(1)}><Glyph name="next"/></button></div>
          <table className={styles.calendar} role="grid" aria-label={month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}>
            <thead><tr>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <th scope="col" key={day}>{day}</th>)}</tr></thead>
            <tbody>{Array.from({ length: 6 }, (_, row) => <tr key={row}>{days.slice(row * 7, row * 7 + 7).map(day => { const key = dateKey(day); return <td key={key} role="gridcell" aria-selected={key === selected}><button type="button" id={`${id}-${key}`} className={styles.day} data-outside={day.getMonth() !== month.getMonth()} data-selected={key === selected} aria-current={key === today ? 'date' : undefined} aria-label={`${prettyDate(day)}${key === selected ? ", selected" : ""}`} tabIndex={key === focused ? 0 : -1} onKeyDown={event => onDayKey(event, day)} onClick={() => { setSelected(key); setFocused(key); setError(''); }}>{day.getDate()}</button></td>; })}</tr>)}</tbody>
          </table>
          <p className="faint">{selected ? prettyDate(fromKey(selected)) : 'No date selected'}</p>
          <label className="field"><span>Time, 24-hour</span><input className="input num" type="text" inputMode="numeric" value={time} onChange={event => { setTime(event.target.value); setError(''); }} placeholder="17:00" maxLength={5} autoComplete="off" aria-describedby={`${id}-time-hint`} aria-invalid={!!error && !timePattern.test(time)}/></label>
          <p className="faint" id={`${id}-time-hint`}>Use HH:MM, from 00:00 to 23:59. Arrow keys move through calendar days; Page Up and Page Down change month.</p>
          {error && <p role="alert" className="notice alert">{error}</p>}
          <div className={styles.actions}><button type="button" className="btn ghost small" onClick={() => { onChange(''); setOpen(false); }}>No due date</button><button type="submit" className="btn">Set due date</button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

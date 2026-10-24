'use client';
import * as Slider from '@radix-ui/react-slider';
import type { Experiment, Parameters } from '@senku/experiment-schema';
import { useEffect, useId, useState } from 'react';
import { fmt, label, unitText } from '../lib/format';

type Spec = Experiment['parameters'][string];

const stepFor = (p: Extract<Spec, { type: 'number' }>) => {
  if (p.integer) return 1;
  const raw = (p.max - p.min) / 200;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
};

export const defaults = (manifest: Experiment): Parameters =>
  Object.fromEntries(Object.entries(manifest.parameters).map(([k, p]) => [k, p.default]));

function NumberControl({ name, spec, value, onChange, disabled }: { name: string; spec: Extract<Spec, { type: 'number' }>; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const id = useId();
  const step = stepFor(spec);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(+value.toPrecision(6))), [value]);
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(n)) return setDraft(String(value));
    const clamped = Math.min(spec.max, Math.max(spec.min, spec.integer ? Math.round(n) : n));
    onChange(clamped);
    setDraft(String(clamped));
  };
  const text = label(name, spec.unit);
  const unit = unitText(spec.unit);
  return (
    <div className="param">
      <div className="param-head">
        <label htmlFor={id}>{text}</label>
        <span className="param-value">
          <input id={id} inputMode="decimal" value={draft} disabled={disabled} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()} aria-describedby={`${id}-range`} />
        </span>
        {unit && <span className="param-unit faint">{unit}</span>}
      </div>
      <Slider.Root className="slider" min={spec.min} max={spec.max} step={step} value={[value]} disabled={disabled}
        onValueChange={([v]) => onChange(+v.toPrecision(8))} aria-label={text}>
        <Slider.Track className="slider-track"><Slider.Range className="slider-range" /></Slider.Track>
        <Slider.Thumb className="slider-thumb" aria-label={`${text}${unit ? ` in ${unit}` : ''}`} />
      </Slider.Root>
      <div className="param-range" id={`${id}-range`}><span>{fmt(spec.min)}</span><span>{fmt(spec.max)}</span></div>
    </div>
  );
}

export function ParameterControls({ manifest, values, onChange, disabled, baseline }: {
  manifest: Experiment; values: Parameters; onChange: (v: Parameters) => void; disabled?: boolean; baseline?: Parameters;
}) {
  const set = (k: string, v: number | string) => onChange({ ...values, [k]: v });
  return (
    <div>
      {Object.entries(manifest.parameters).map(([name, spec]) => {
        const changed = baseline && baseline[name] !== values[name];
        const marker = changed ? <span className="chip tone" data-stain="hema" style={{ marginLeft: '.4rem' }}>changed</span> : null;
        if (spec.type === 'number') return (
          <div key={name} data-stain={changed ? 'hema' : undefined}>
            <NumberControl name={name} spec={spec} value={Number(values[name])} onChange={(v) => set(name, v)} disabled={disabled} />
          </div>
        );
        if (spec.type === 'enum') return (
          <fieldset key={name} className="param" style={{ border: 0, margin: 0 }} disabled={disabled}>
            <legend className="label" style={{ fontWeight: 800, padding: 0, marginBottom: '.5rem' }}>{label(name)}{marker}</legend>
            <div className="segmented">
              {spec.values.map((v) => (
                <label key={v}><input type="radio" name={name} value={v} checked={values[name] === v} onChange={() => set(name, v)} /><span>{v}</span></label>
              ))}
            </div>
          </fieldset>
        );
        return (
          <label key={name} className="param field">
            <span>{label(name)} <span className="faint">({spec.unit})</span>{marker}</span>
            <input className="input mono" value={String(values[name])} maxLength={spec.max_length} disabled={disabled} spellCheck={false}
              onChange={(e) => set(name, e.target.value)} required />
          </label>
        );
      })}
    </div>
  );
}

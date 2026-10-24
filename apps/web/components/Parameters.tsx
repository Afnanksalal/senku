'use client';
import * as Slider from '@radix-ui/react-slider';
import type { Experiment, Parameters } from '@senku/experiment-schema';
import { useEffect, useId, useState } from 'react';
import { fmt, unitText } from '../lib/format';
import { parameterLanguage, parameterValue } from '../lib/learner-language';
import styles from './learner-controls.module.css';

type Spec = Experiment['parameters'][string];

const stepFor = (p: Extract<Spec, { type: 'number' }>) => {
  if (p.integer) return 1;
  const raw = (p.max - p.min) / 200;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
};

export const defaults = (manifest: Experiment): Parameters =>
  Object.fromEntries(Object.entries(manifest.parameters).map(([k, p]) => [k, p.default]));

function NumberControl({ experimentId, name, spec, value, onChange, disabled, precise, changed }: { experimentId: string; name: string; spec: Extract<Spec, { type: 'number' }>; value: number; onChange: (v: number) => void; disabled?: boolean; precise: boolean; changed?: boolean }) {
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
  const language = parameterLanguage(experimentId, name);
  const text = language.name;
  const unit = unitText(spec.unit);
  if (!precise) return <div className={`${styles.simple} ${changed ? styles.changed : ''}`} data-parameter={name}>
    <div className={styles.heading}><span id={`${id}-label`}>{text}</span><output className={styles.value}>{parameterValue(language, value, spec.min, spec.max)}</output></div>
    <p className={styles.help} id={`${id}-help`}>{language.help}</p>
    <Slider.Root className="slider" min={spec.min} max={spec.max} step={step} value={[value]} disabled={disabled}
      onValueChange={([v]) => onChange(+v.toPrecision(8))} aria-labelledby={`${id}-label`}>
      <Slider.Track className="slider-track"><Slider.Range className="slider-range" /></Slider.Track>
      <Slider.Thumb className="slider-thumb" aria-label={text} aria-describedby={`${id}-help`} aria-valuetext={`${parameterValue(language, value, spec.min, spec.max)}. Exact value ${fmt(value)} ${unit}.`} />
    </Slider.Root>
    <div className={styles.ends}><span>{language.low ?? 'Lower'}</span><span>{language.high ?? 'Higher'}</span></div>
    {changed && <p className="faint">Changed from your starting run</p>}
  </div>;
  return (
    <div className={`param ${styles.preciseControl}`} data-parameter={name}>
      <div className="param-head">
        <label htmlFor={id}>{text}</label>
        <span className="param-value">
          <input id={id} inputMode="decimal" value={draft} disabled={disabled} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()} aria-describedby={`${id}-range`} />
        </span>
        {unit && <span className="param-unit faint">{unit}</span>}
      </div>
      <p className={styles.help}>{language.help}</p>
      <Slider.Root className="slider" min={spec.min} max={spec.max} step={step} value={[value]} disabled={disabled}
        onValueChange={([v]) => onChange(+v.toPrecision(8))} aria-label={text}>
        <Slider.Track className="slider-track"><Slider.Range className="slider-range" /></Slider.Track>
        <Slider.Thumb className="slider-thumb" aria-label={`${text}${unit ? ` in ${unit}` : ''}`} />
      </Slider.Root>
      <div className="param-range" id={`${id}-range`}><span>{fmt(spec.min)}</span><span>{fmt(spec.max)}</span></div>
      <p className="faint">Model field: <code>{name}</code></p>
    </div>
  );
}

export function ParameterControls({ manifest, values, onChange, disabled, baseline, defaultPrecise = false }: {
  manifest: Experiment; values: Parameters; onChange: (v: Parameters) => void; disabled?: boolean; baseline?: Parameters; defaultPrecise?: boolean;
}) {
  const [precise, setPrecise] = useState(defaultPrecise);
  const set = (k: string, v: number | string) => onChange({ ...values, [k]: v });
  return (
    <div>
      {Object.values(manifest.parameters).some((spec) => spec.type === 'number') && <div className={styles.mode}><span>Choose how much detail to show</span><div className={styles.modeButtons} role="group" aria-label="Control detail"><button type="button" className="btn quiet small" aria-pressed={!precise} onClick={() => setPrecise(false)}>Simple</button><button type="button" className="btn quiet small" aria-pressed={precise} onClick={() => setPrecise(true)}>Precise</button></div></div>}
      {Object.entries(manifest.parameters).map(([name, spec]) => {
        const language = parameterLanguage(manifest.id, name);
        const changed = baseline && baseline[name] !== values[name];
        const marker = changed ? <span className="chip tone" data-stain="hema" style={{ marginLeft: '.4rem' }}>changed</span> : null;
        if (spec.type === 'number') return (
          <div key={name} data-stain={changed ? 'hema' : undefined}>
            <NumberControl experimentId={manifest.id} name={name} spec={spec} value={Number(values[name])} onChange={(v) => set(name, v)} disabled={disabled} precise={precise} changed={!!changed} />
          </div>
        );
        if (spec.type === 'enum') return (
          <fieldset key={name} className="param" style={{ border: 0, margin: 0 }} disabled={disabled}>
            <legend className="label" style={{ fontWeight: 800, padding: 0, marginBottom: '.5rem' }}>{language.name}{marker}</legend>
            <p className={styles.help}>{language.help}</p>
            <div className="segmented">
              {spec.values.map((v) => (
                <label key={v}><input type="radio" name={name} value={v} checked={values[name] === v} onChange={() => set(name, v)} /><span>{precise ? v : language.choices?.[v] ?? v}</span></label>
              ))}
            </div>
          </fieldset>
        );
        return (
          <div key={name} className="param field" data-parameter={name}>
            <strong>{language.name}{marker}</strong>
            <p className={styles.help}>{language.help}</p>
            {manifest.id === 'molecule-sketchbook' && name === 'smiles' && <div className={styles.examples}>{[['Water','O'],['Oxygen','O=O'],['Ethanol','CCO'],['Acetic acid','CC(=O)O']].map(([title,code]) => <button type="button" className="btn quiet small" key={code} disabled={disabled} aria-pressed={values[name] === code} onClick={() => set(name,code)}>{title}</button>)}</div>}
            <label className="field"><span>{name === 'smiles' ? 'Molecule code' : `${language.name} (${spec.unit})`}</span><input className="input mono" value={String(values[name])} maxLength={spec.max_length} disabled={disabled} spellCheck={false} onChange={(e) => set(name, e.target.value)} required /></label>
          </div>
        );
      })}
    </div>
  );
}

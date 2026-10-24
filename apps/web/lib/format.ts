import type { RunStatus } from './runs';

const number = new Intl.NumberFormat('en', { maximumSignificantDigits: 4 });
export const fmt = (n: number) => Number.isFinite(n) ? number.format(n) : String(n);

export const unitText = (unit?: string) => !unit || unit === 'dimensionless' ? '' : unit.replace(/_/g, ' ');

/** "substrate_mM" reads as "Substrate": a trailing mixed-case segment is a unit suffix, not part of the name. */
export function label(key: string, unit?: string) {
  const stripped = unit && key.endsWith(`_${unit}`) ? key.slice(0, -unit.length - 1) : key.replace(/_[a-z]*[A-Z][A-Za-z]*$/, '');
  const words = stripped.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const statusText: Record<RunStatus, string> = {
  queued: 'Waiting for a lab slot', running: 'Running', completed: 'Done',
  failed: 'Didn\u2019t finish', cancelled: 'Cancelled', timed_out: 'Ran out of time',
};

const errors: Record<string, string> = {
  timed_out: 'The model took longer than its time limit. Try a shorter duration.',
  invalid_input: 'The engine rejected these settings. Adjust a parameter and run again.',
  invalid_output: 'The engine returned results that failed checks, so they were discarded.',
  output_limit: 'The results were too large to keep. Try fewer steps or a smaller grid.',
  engine_error: 'The scientific engine stopped with an error. Run again, or change a setting.',
  execution_unavailable: 'The lab server couldn\u2019t run this right now. Try again shortly.',
  device_kernel_unavailable: 'This experiment can\u2019t run on your device. It needs the lab server.',
};
export const runError = (code?: string | null) => (code && errors[code]) ?? 'The run didn\u2019t finish. Try again.';

export const scientificStatusText: Record<string, string> = {
  illustrative_educational: 'Illustrative teaching model',
  validated_prediction: 'Validated prediction',
  literature_value: 'Literature value',
  measured_data: 'Measured data',
};

export const when = (iso?: string | null) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
export const shortId = (id: string) => id.slice(0, 8);

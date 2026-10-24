import type { ReactNode, SVGProps } from 'react';

const paths = {
  run: <path d="M8 5.5c0-1 1.1-1.6 2-1.1l9 5.8c.8.5.8 1.7 0 2.2l-9 5.8c-.9.5-2-.1-2-1.1z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="3.5" />,
  check: <path d="M5 12.5l4.2 4.2L19 7" fill="none" />,
  back: <path d="M14.5 5.5L8 12l6.5 6.5" fill="none" />,
  next: <path d="M9.5 5.5L16 12l-6.5 6.5" fill="none" />,
  close: <path d="M6.5 6.5l11 11m0-11l-11 11" fill="none" />,
  device: <g fill="none"><rect x="7" y="3.5" width="10" height="17" rx="3" /><path d="M10.5 17.5h3" /></g>,
  server: <g fill="none"><rect x="4" y="4.5" width="16" height="6.5" rx="2.5" /><rect x="4" y="13" width="16" height="6.5" rx="2.5" /><circle cx="8" cy="7.75" r=".9" fill="currentColor" /><circle cx="8" cy="16.25" r=".9" fill="currentColor" /></g>,
  compare: <g fill="none"><path d="M4 18c3-7 5-10 8-10s5 4 8 10" /><path d="M4 14c3-2 6-6 9-6 2 0 4 1 7 3" strokeDasharray="2 2.6" /></g>,
  download: <g fill="none"><path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5" /><path d="M5 19.5h14" /></g>,
  person: <g fill="none"><circle cx="12" cy="8.5" r="3.8" /><path d="M5 20c.8-3.8 3.6-5.8 7-5.8s6.2 2 7 5.8" /></g>,
  spark: <path d="M12 3.5l1.9 5.2 5.6.3-4.4 3.5 1.5 5.4L12 14.8l-4.6 3.1 1.5-5.4-4.4-3.5 5.6-.3z" />,
  reset: <g fill="none"><path d="M5.5 12a6.5 6.5 0 1 0 2-4.7" /><path d="M5 4.5v3.8h3.8" /></g>,
  info: <g fill="none"><circle cx="12" cy="12" r="8" /><path d="M12 11v5" /><circle cx="12" cy="8" r=".9" fill="currentColor" /></g>,
  flask: <g fill="none"><path d="M9.5 3.5h5M10.5 3.5v5.3L5.6 17.3A2.2 2.2 0 0 0 7.5 20.5h9a2.2 2.2 0 0 0 1.9-3.2l-4.9-8.5V3.5" /><path d="M7.8 14.5h8.4" /></g>,
} as const;

/** Original concept artwork keyed by the manifest's learning concept. Unknown concepts fall back to the flask. */
const concepts: Record<string, ReactNode> = {
  'molecular-structure': <g fill="none"><circle cx="7" cy="8" r="2.6" /><circle cx="17" cy="7" r="2.2" /><circle cx="12" cy="17" r="3" /><path d="M9.3 9.3l1.6 5M14.9 8.2l-1.6 6.1M9.6 8l5.2-.6" /></g>,
  'limiting-resources': <g fill="none"><rect x="4" y="5" width="5" height="14" rx="2.5" /><rect x="10.5" y="9" width="5" height="10" rx="2.5" /><rect x="17" y="13" width="3.5" height="6" rx="1.75" /></g>,
  'enzyme-saturation': <g fill="none"><path d="M4 19c2.5-9 6-12 16-12" /><path d="M4 7h16" strokeDasharray="1.5 2.5" /></g>,
  'carrying-capacity': <g fill="none"><path d="M4 19c4 0 5-12 9-12h7" /><path d="M4 7h16" strokeDasharray="1.5 2.5" /><circle cx="6" cy="18" r="1" fill="currentColor" /></g>,
  inheritance: <g fill="none"><circle cx="7" cy="6.5" r="2.5" /><circle cx="17" cy="6.5" r="2.5" /><path d="M7 9v2.5c0 2 2.2 3 5 3s5-1 5-3V9M12 14.5v2" /><circle cx="12" cy="19" r="2" /></g>,
  diffusion: <g fill="none"><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="5" strokeDasharray="1.5 2.3" /><circle cx="12" cy="12" r="8.5" strokeDasharray="1 3.4" /></g>,
  'ecosystem-feedback': <g fill="none"><path d="M12 20c-4.5 0-7-3-7-7 4 0 7 2.5 7 7z" /><path d="M12 20c0-6 2.5-10 7.5-11-.2 6-3 10.5-7.5 11z" /><path d="M12 20V11" /></g>,
  'reaction-networks': <g fill="none"><circle cx="5.5" cy="12" r="2.2" /><circle cx="18.5" cy="6" r="2.2" /><circle cx="18.5" cy="18" r="2.2" /><path d="M7.6 11l8.7-4M7.6 13l8.7 4M18.5 8.2v7.6" /></g>,
  'flux-balance': <g fill="none"><path d="M3.5 12h5M15.5 12h5M12 3.5v5M12 15.5v5" /><circle cx="12" cy="12" r="3.3" /></g>,
  'cell-populations': <g fill="none"><circle cx="8.5" cy="9" r="3.6" /><circle cx="15.5" cy="9.5" r="3" /><circle cx="11.5" cy="15.8" r="3.4" /><circle cx="8.5" cy="9" r=".9" fill="currentColor" /><circle cx="11.5" cy="15.8" r=".9" fill="currentColor" /></g>,
};

type Props = SVGProps<SVGSVGElement> & { size?: number };
export function Glyph({ name, size = 20, ...rest }: Props & { name: keyof typeof paths }) {
  const filled = name === 'run' || name === 'stop' || name === 'spark';
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={filled ? 0 : 1.9} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {paths[name]}
    </svg>
  );
}

export function ConceptGlyph({ concept, size = 28, ...rest }: Props & { concept: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none" {...rest}>
      {concepts[concept] ?? paths.flask}
    </svg>
  );
}

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M16 3.5c6.9 0 12.5 5.3 12.5 12.2 0 7.1-5.4 12.8-12.6 12.8C8.8 28.5 3.5 23 3.5 16 3.5 9 9 3.5 16 3.5z" fill="var(--chlorophyll)" />
      <path d="M16 3.5c6.9 0 12.5 5.3 12.5 12.2 0 7.1-5.4 12.8-12.6 12.8" fill="none" stroke="var(--chlorophyll-deep)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="13" cy="14" r="5" fill="var(--paper)" />
      <circle cx="14.2" cy="14.6" r="2.3" fill="var(--hema)" />
      <circle cx="21.5" cy="20.5" r="1.8" fill="var(--pollen)" />
    </svg>
  );
}

/** Stable stain colour for a concept so each experiment keeps its identity across screens. */
export function stainFor(key: string) {
  const stains = ['hema', 'eosin', 'chlorophyll', 'cobalt', 'pollen'] as const;
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return stains[h % stains.length];
}

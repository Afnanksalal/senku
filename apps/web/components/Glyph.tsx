import type { ReactNode, SVGProps } from 'react';

/* Original rounded silhouettes. Solid shapes and a second tint share the surrounding UI color. */
const paths = {
  home:<g><path d="m3 10 7.5-6a2.5 2.5 0 0 1 3 0l7.5 6a1.7 1.7 0 0 1-1 3H4a1.7 1.7 0 0 1-1-3Z" fill="currentColor"/><path d="M5 11h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" fill="currentColor" opacity=".35"/><rect x="10" y="14" width="4" height="7" rx="1.5" fill="currentColor"/></g>,
  book:<g><path d="M3 5a2 2 0 0 1 2-2h3c2.5 0 4 1.5 4 3v15c-1.2-1.3-2.7-2-5-2H5a2 2 0 0 1-2-2Z" fill="currentColor" opacity=".35"/><path d="M21 5a2 2 0 0 0-2-2h-3c-2.5 0-4 1.5-4 3v15c1.2-1.3 2.7-2 5-2h2a2 2 0 0 0 2-2Z" fill="currentColor"/><path d="M6 7h3m-3 4h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></g>,
  search:<g><circle cx="10.5" cy="10.5" r="7" fill="currentColor" opacity=".25"/><circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="3.3"/><path d="m15 15 5 5" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></g>,
  grid:<g fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="3"/><rect x="13" y="3" width="8" height="8" rx="3" opacity=".35"/><rect x="3" y="13" width="8" height="8" rx="3" opacity=".35"/><rect x="13" y="13" width="8" height="8" rx="3"/></g>,
  flame:<g fill="currentColor"><path d="M13 2c2 6-3 6-2 10 2-1 3-3 3-5 4 3 7 6 5 11-2 5-11 6-14 0-2-4 0-8 3-11 0 3 1 4 2 4-1-4 2-6 3-9Z" opacity=".35"/><path d="M13 10c0 4-4 4-4 7a3.5 3.5 0 0 0 7 0c0-2-1-3-2-4 0 2-1 2-2 3-1-2 1-3 1-6Z"/></g>,
  trophy:<g><path d="M7 6H4v3c0 3 2 4 5 4m8-7h3v3c0 3-2 4-5 4" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/><path d="M7 3h10a1 1 0 0 1 1 1v6a6 6 0 0 1-12 0V4a1 1 0 0 1 1-1Z" fill="currentColor" opacity=".4"/><path d="M10.5 15h3v4H17a1.5 1.5 0 0 1 0 3H7a1.5 1.5 0 0 1 0-3h3.5Z" fill="currentColor"/></g>,
  run:<path d="M7 5a2 2 0 0 1 3-1.7l10 7a2 2 0 0 1 0 3.4l-10 7A2 2 0 0 1 7 19Z" fill="currentColor"/>,
  stop:<rect x="4" y="4" width="16" height="16" rx="5" fill="currentColor"/>,
  check:<path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round"/>,
  back:<path d="m14.5 5-7 7 7 7" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>,
  next:<path d="m9.5 5 7 7-7 7" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>,
  close:<path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>,
  device:<g><rect x="5" y="2" width="14" height="20" rx="4" fill="currentColor" opacity=".3"/><rect x="8" y="5" width="8" height="11" rx="2" fill="currentColor"/><path d="M10 19h4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></g>,
  server:<g fill="currentColor"><rect x="3" y="3" width="18" height="8" rx="3" opacity=".35"/><rect x="3" y="13" width="18" height="8" rx="3"/><circle cx="7" cy="7" r="1.5"/><path d="M12 6h5v2h-5Z"/><circle cx="7" cy="17" r="1.5" fill="var(--paper)"/><path d="M12 16h5v2h-5Z" fill="var(--paper)"/></g>,
  compare:<g><rect x="3" y="11" width="5" height="10" rx="2.5" fill="currentColor" opacity=".35"/><rect x="10" y="6" width="5" height="15" rx="2.5" fill="currentColor" opacity=".65"/><rect x="17" y="2" width="5" height="19" rx="2.5" fill="currentColor"/></g>,
  download:<g><path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".45"/><path d="M12 3v12m-5-5 5 5 5-5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></g>,
  person:<g fill="currentColor"><circle cx="12" cy="7.5" r="4.5"/><path d="M3 20c0-5 4-8 9-8s9 3 9 8c0 1-1 2-2 2H5c-1 0-2-1-2-2Z" opacity=".35"/></g>,
  spark:<path d="m13 2 2 6 6 2a1 1 0 0 1 0 2l-6 2-2 7a1 1 0 0 1-2 0l-2-7-7-2a1 1 0 0 1 0-2l7-2 2-6a1 1 0 0 1 2 0Z" fill="currentColor"/>,
  reset:<g><circle cx="12" cy="12" r="8" fill="currentColor" opacity=".2"/><path d="M5 8a7.5 7.5 0 1 1-1 7M4 3v6h6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></g>,
  info:<g><circle cx="12" cy="12" r="10" fill="currentColor" opacity=".25"/><path d="M12 11v6" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><circle cx="12" cy="7" r="1.7" fill="currentColor"/></g>,
  flask:<g><path d="M9 3h6m-5 0v6l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 13h8l4 6c.5 1-.5 2-2 2H6c-1.5 0-2.5-1-2-2Z" fill="currentColor" opacity=".35"/><circle cx="11" cy="17" r="1.5" fill="currentColor"/></g>,
} as const;
const concepts:Record<string,ReactNode>={
 'molecular-structure':<g><path d="m7 7 10 1-5 10Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" opacity=".4"/><circle cx="6" cy="7" r="4" fill="currentColor"/><circle cx="18" cy="8" r="3.5" fill="currentColor" opacity=".65"/><circle cx="12" cy="18" r="4.5" fill="currentColor"/></g>,
 'limiting-resources':<g fill="currentColor"><path d="M4 8C4 3 8 2 13 3c6 0 9 4 8 9 0 6-4 10-10 9-5 0-8-5-7-13Z" opacity=".3"/><rect x="7" y="7" width="4" height="11" rx="2"/><rect x="13" y="11" width="4" height="7" rx="2"/><circle cx="15" cy="7" r="2"/></g>,
 'enzyme-saturation':<g fill="currentColor"><path d="M13 3a9 9 0 1 0 8 13l-7-4 2-8Z" opacity=".4"/><path d="m19 3 3 6-6 2 1-7Z"/><circle cx="8" cy="12" r="2"/></g>,
 'carrying-capacity':<g><path d="M12 21V10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M12 16C4 16 2 11 3 7c7-1 10 3 9 9Z" fill="currentColor" opacity=".4"/><path d="M12 11C12 4 17 1 22 3c0 6-4 9-10 8Z" fill="currentColor"/></g>,
 inheritance:<g><path d="m7 4 10 16M17 4 7 20" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity=".35"/><path d="m7 4 3 5m4 6 3 5" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/></g>,
 diffusion:<g fill="currentColor"><circle cx="12" cy="12" r="4"/><circle cx="4" cy="5" r="2.5" opacity=".4"/><circle cx="20" cy="5" r="2.5" opacity=".4"/><circle cx="4" cy="19" r="2.5" opacity=".4"/><circle cx="20" cy="19" r="2.5" opacity=".4"/><circle cx="21" cy="12" r="1.5"/><circle cx="3" cy="12" r="1.5"/></g>,
 'ecosystem-feedback':<g><path d="M5 19C1 7 10 1 21 3c1 11-5 20-16 16Z" fill="currentColor" opacity=".35"/><path d="M5 20 16 9m-6 6v-5m0 5h5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></g>,
 'reaction-networks':<g><path d="m5 12 13-7v14Z" stroke="currentColor" strokeWidth="3" opacity=".35"/><circle cx="5" cy="12" r="4" fill="currentColor"/><circle cx="18" cy="5" r="4" fill="currentColor" opacity=".7"/><circle cx="18" cy="19" r="4" fill="currentColor"/></g>,
 'flux-balance':<g><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".25"/><path d="M3 12h18m-5-5 5 5-5 5M8 4v4m0 8v4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></g>,
 'cell-populations':<g fill="currentColor"><circle cx="8" cy="8" r="6" opacity=".35"/><circle cx="17" cy="10" r="5" opacity=".6"/><circle cx="10" cy="17" r="6"/><circle cx="8" cy="7" r="2"/><circle cx="10" cy="17" r="2" fill="var(--paper)"/></g>,
};
type Props=SVGProps<SVGSVGElement>&{size?:number};
export function Glyph({name,size=20,...rest}:Props&{name:keyof typeof paths}){return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" fill="none" style={{flexShrink:0,verticalAlign:'middle',...rest.style}} {...rest}>{paths[name]}</svg>;}
export function ConceptGlyph({concept,size=28,...rest}:Props&{concept:string}){return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" fill="none" style={{flexShrink:0,...rest.style}} {...rest}>{concepts[concept]??paths.flask}</svg>;}
/* eslint-disable @next/next/no-img-element -- small local vector brand asset */
export function BrandMark({size=36}:{size?:number}){return <img src="/art/senku-mark.svg" width={size} height={size} alt="" aria-hidden="true" draggable={false} style={{flexShrink:0}}/>;}
export function stainFor(key:string){const stains=['hema','eosin','chlorophyll','cobalt','pollen'] as const;let h=0;for(const c of key)h=(h*31+c.charCodeAt(0))>>>0;return stains[h%stains.length];}

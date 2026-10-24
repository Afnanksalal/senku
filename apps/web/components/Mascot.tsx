/* eslint-disable @next/next/no-img-element -- pre-sized static webp art, no optimizer needed */
type Mood = 'wave' | 'think' | 'cheer' | 'puzzled';

/** Decorative companion art. It never carries information, so it is hidden from assistive tech. */
export function Mascot({ mood, size = 160, className = '' }: { mood: Mood; size?: number; className?: string }) {
  return <img src={`/art/mascot-${mood}.webp`} alt="" aria-hidden="true" width={size} height={size} className={`mascot ${className}`} draggable={false} />;
}

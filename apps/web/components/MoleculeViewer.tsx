'use client';
import { useEffect, useRef, useState } from 'react';

/** Mol* renders the conformer the RDKit run returned. Loaded only when a molecule result is on screen. */
export default function MoleculeViewer({ molblock, label }: { molblock: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported'>('loading');
  useEffect(() => {
    let disposed = false;
    let plugin: { dispose: () => void } | undefined;
    (async () => {
      // Mol*'s CommonJS distribution preserves its initialization order in Turbopack.
      const [{ PluginContext }, { DefaultPluginSpec }] = await Promise.all([import('molstar/lib/commonjs/mol-plugin/context'), import('molstar/lib/commonjs/mol-plugin/spec')]);
      const p = new PluginContext(DefaultPluginSpec());
      plugin = p;
      await p.init();
      if (disposed || !host.current) return p.dispose();
      if (!(await p.mountAsync(host.current))) { setState('unsupported'); return; }
      p.canvas3d?.setProps({ renderer: { backgroundColor: 0xf7faf6 as never } });
      const data = await p.builders.data.rawData({ data: molblock, label });
      const trajectory = await p.builders.structure.parseTrajectory(data, 'mol');
      await p.builders.structure.hierarchy.applyPreset(trajectory, 'default');
      if (!disposed) setState('ready');
    })().catch((error: unknown) => {
      console.warn('Molecular viewer initialization failed', error);
      if (!disposed) setState('unsupported');
    });
    return () => { disposed = true; plugin?.dispose(); };
  }, [molblock, label]);
  return (
    <div className="mol-view" role="img" aria-label={`Interactive 3D conformer of ${label}. Drag to rotate, scroll to zoom.`}>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      {state !== 'ready' && (
        <p className="faint" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '1rem', textAlign: 'center' }}>
          {state === 'loading' ? 'Building 3D view' : '3D view isn\u2019t available on this device. The formula and descriptors above come from the same run.'}
        </p>
      )}
    </div>
  );
}

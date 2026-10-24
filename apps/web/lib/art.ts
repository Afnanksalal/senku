const covers = new Set([
  'cell-colony', 'cell-energy', 'diffusion-playground', 'ecosystem-rescue', 'enzyme-explorer',
  'genetics-lab', 'metabolism-explorer', 'molecule-sketchbook', 'pathway-playground', 'population-dynamics',
]);

/** Illustrated cover for a catalog experiment; new experiments fall back to their concept glyph. */
export const coverFor = (experimentId: string) => (covers.has(experimentId) ? `/art/cover-${experimentId}.webp` : undefined);

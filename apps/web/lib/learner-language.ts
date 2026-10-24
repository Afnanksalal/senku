import { fmt, label } from './format';

export type ParameterLanguage = { name: string; help: string; low?: string; high?: string; display?: 'amount' | 'relative100' | 'fraction100' | 'minutes' | 'temperature' | 'grid'; choices?: Record<string, string> };
export type ResultLanguage = { name: string; help: string };
type ModelLanguage = { question: string; parameters: Record<string, ParameterLanguage>; results?: Record<string, ResultLanguage> };

/** Presentation only. Keys, values, bounds, units and solver behavior remain in the manifest. */
export const learnerLanguage: Record<string, ModelLanguage> = {
  'cell-energy': { question: 'What does this cell need to keep going?', parameters: {
    oxygen: { name: 'Oxygen supply', help: 'A relative supply in this teaching model, not a blood oxygen reading.', low: 'Less oxygen', high: 'More oxygen', display: 'relative100' },
    glucose: { name: 'Sugar supply', help: 'The glucose available as a resource in this model.', low: 'Less sugar', high: 'More sugar', display: 'relative100' },
    demand: { name: 'Energy needed', help: 'How much the model cell needs compared with its available resources.', low: 'Less needed', high: 'More needed', display: 'relative100' },
  }, results: { energy_index: { name: 'Energy needs met', help: 'A model score out of 100. It compares the limiting resource with demand.' } } },
  'enzyme-explorer': { question: 'Why does adding more starting material eventually stop helping?', parameters: {
    substrate_mM: { name: 'Starting material', help: 'The amount available for the enzyme to turn into product.', low: 'Less available', high: 'More available' },
    vmax: { name: 'Fastest reaction speed', help: 'The speed limit the enzyme approaches when plenty of starting material is available.', low: 'Slower limit', high: 'Faster limit' },
    km_mM: { name: 'Material needed for half speed', help: 'How much starting material is needed to reach half of the enzyme’s speed limit.', low: 'Less needed', high: 'More needed' },
    duration: { name: 'Time to simulate', help: 'Time inside the model, not how long the server takes to run it.', low: 'Shorter', high: 'Longer', display: 'minutes' },
  }, results: {
    initial_rate: { name: 'Starting reaction speed', help: 'How quickly the enzyme starts turning the starting material into product.' },
    final_substrate: { name: 'Starting material left', help: 'The concentration left at the end of this model run.' },
    final_product: { name: 'Product made', help: 'The product concentration at the end of this model run.' },
  } },
  'population-dynamics': { question: 'What makes this population grow or level off?', parameters: {
    initial_population: { name: 'Starting population', help: 'The size of the group at the start of the model.', low: 'Smaller group', high: 'Larger group', display: 'amount' },
    capacity: { name: 'Room for growth', help: 'The population size this simplified environment can support.', low: 'Less room', high: 'More room', display: 'amount' },
    growth_rate: { name: 'Growth speed', help: 'How fast the population can grow before crowding slows it down.', low: 'Slower growth', high: 'Faster growth' },
    duration: { name: 'Time to simulate', help: 'Time inside the model, not the time spent waiting for a result.', low: 'Shorter', high: 'Longer', display: 'minutes' },
  }, results: { final_population: { name: 'Population at the end', help: 'The calculated group size after the simulated time.' } } },
  'genetics-lab': { question: 'Why can offspring differ from their parents?', parameters: {
    parent1: { name: 'First parent’s gene copies', help: 'Each parent passes on one of these two copies.', choices: { AA: 'AA, two A copies', Aa: 'Aa, one of each', aa: 'aa, two a copies' } },
    parent2: { name: 'Second parent’s gene copies', help: 'The letters identify gene versions in this simple inheritance model.', choices: { AA: 'AA, two A copies', Aa: 'Aa, one of each', aa: 'aa, two a copies' } },
    sample_size: { name: 'Offspring to sample', help: 'More samples usually give a clearer picture of the expected pattern.', low: 'Fewer offspring', high: 'More offspring', display: 'amount' },
  }, results: {
    AA: { name: 'Two A copies (AA)', help: 'Sampled offspring that inherited an A copy from each parent.' },
    Aa: { name: 'One of each (Aa)', help: 'Sampled offspring that inherited one A and one a copy.' },
    aa: { name: 'Two a copies (aa)', help: 'Sampled offspring that inherited an a copy from each parent.' },
  } },
  'diffusion-playground': { question: 'What makes a substance spread through this space?', parameters: {
    diffusivity: { name: 'Spread speed', help: 'How quickly the substance spreads through the model grid.', low: 'Slower spread', high: 'Faster spread' },
    grid_size: { name: 'Map detail', help: 'Squares along each side of the grid. These are map squares, not biological cells.', low: 'Coarser map', high: 'Finer map', display: 'grid' },
    steps: { name: 'Steps to simulate', help: 'How many updates the model calculates. This is separate from real waiting time.', low: 'Fewer steps', high: 'More steps', display: 'amount' },
  }, results: {
    mass: { name: 'Substance remaining', help: 'Total relative amount in the closed grid. Spreading should not create or lose it.' },
    elapsed_time: { name: 'Time inside the model', help: 'Simulated time covered by the calculated steps.' },
  } },
  'ecosystem-rescue': { question: 'How do light, nutrients, algae, and oxygen affect each other?', parameters: {
    nutrients: { name: 'Nutrient supply', help: 'A relative amount added over time, not a measured water sample.', low: 'Less added', high: 'More added' },
    light: { name: 'Light available', help: 'Light strength relative to this model’s maximum.', low: 'Darker', high: 'Brighter', display: 'fraction100' },
    temperature: { name: 'Water temperature', help: 'The temperature setting used by this simplified model.', low: 'Cooler', high: 'Warmer', display: 'temperature' },
    duration: { name: 'Time to simulate', help: 'Time inside the model, not how long the calculation takes.', low: 'Shorter', high: 'Longer', display: 'minutes' },
  }, results: {
    nutrients: { name: 'Nutrients left', help: 'Relative nutrient level at the end, in this model’s own scale.' },
    algae: { name: 'Algae level', help: 'Relative algae level at the end, not a measured organism count.' },
    oxygen: { name: 'Oxygen level', help: 'Relative oxygen level at the end, not a real-world water reading.' },
  } },
  'pathway-playground': { question: 'How does material move through my reaction network?', parameters: {
    duration: { name: 'Time to simulate', help: 'How far forward to calculate your approved reaction network.', low: 'Shorter', high: 'Longer', display: 'minutes' },
  } },
  'metabolism-explorer': { question: 'What can the network make with the resources available?', parameters: {
    uptake: { name: 'Resource coming in', help: 'The upper limit on resource entering this small teaching network.', low: 'Less available', high: 'More available' },
    maintenance: { name: 'Resource needed to keep going', help: 'The minimum demand the network must meet before making product.', low: 'Less needed', high: 'More needed' },
  }, results: {
    feasible: { name: 'Can the network meet its needs?', help: 'Whether the toy network can satisfy all its constraints.' },
    product_flux: { name: 'Product-making rate', help: 'The best product rate allowed by this model’s resource limits.' },
  } },
  'cell-colony': { question: 'What changes when this model colony starts with more cells?', parameters: {
    initial_cells: { name: 'Starting cells', help: 'The number of cells placed in the approved teaching template.', low: 'Fewer cells', high: 'More cells', display: 'amount' },
    duration: { name: 'Time to simulate', help: 'Time inside the cell-colony model, not the calculation’s waiting time.', low: 'Shorter', high: 'Longer', display: 'minutes' },
  }, results: { cell_count: { name: 'Cells at the end', help: 'The number of cells in the final simulated frame.' } } },
  'molecule-sketchbook': { question: 'What can this molecule’s structure tell me?', parameters: {
    smiles: { name: 'Choose a molecule', help: 'Pick an example or enter a standard molecule code. The code describes how atoms connect.' },
    generate_3d: { name: 'Build a 3D shape', help: 'A possible shape calculated from the molecule code, not a measured structure.', choices: { yes: 'Show a 3D shape', no: 'Just the properties' } },
  }, results: {
    molecular_weight: { name: 'Molecular mass', help: 'The mass of one mole of this molecule.' },
    hydrogen_bond_donors: { name: 'Hydrogen-bond donor sites', help: 'The number of sites that can donate a hydrogen bond.' },
    hydrogen_bond_acceptors: { name: 'Hydrogen-bond acceptor sites', help: 'The number of sites that can accept a hydrogen bond.' },
  } },
};

export const parameterLanguage = (experimentId: string, key: string): ParameterLanguage => learnerLanguage[experimentId]?.parameters[key] ?? { name: label(key.replaceAll('-', ' ')), help: 'This changes the approved model parameter. Exact units are available in Precise controls.', low: 'Lower', high: 'Higher' };
export const resultLanguage = (experimentId: string, key: string): ResultLanguage => learnerLanguage[experimentId]?.results?.[key] ?? { name: label(key.replaceAll('-', ' ')), help: 'A calculated output of this model. Exact quantity and units are available below.' };
export function parameterValue(language: ParameterLanguage, value: number, min: number, max: number): string {
  if (language.display === 'relative100') return `${fmt(value)} / 100`;
  if (language.display === 'fraction100') return `${fmt(value * 100)}% of maximum`;
  if (language.display === 'minutes') return `${fmt(value)} min simulated`;
  if (language.display === 'temperature') return `${fmt(value)} °C`;
  if (language.display === 'grid') return `${value} × ${value}`;
  if (language.display === 'amount') return fmt(value);
  const fraction = max === min ? 0 : (value - min) / (max - min);
  return fraction <= .1 ? 'Very low' : fraction < .35 ? 'Low' : fraction < .65 ? 'Medium' : fraction < .9 ? 'High' : 'Very high';
}
export function learnerUnit(unit?: string): string {
  const units: Record<string, string> = {
    normalized_index_percent: 'out of 100 in this model', normalized_index: 'relative model level', normalized_flux_units: 'model rate units', normalized_mass: 'relative model amount', normalized_mass_per_cell: 'relative amount per grid square',
    mM: 'millimolar', 'mM/min': 'millimolar per minute', min: 'minutes simulated', individuals: 'individuals in the model', cells: 'cells', offspring: 'offspring sampled', count: 'sites', 'g/mol': 'grams per mole', boolean: 'model check', dimensionless: 'model value',
  };
  return unit ? units[unit] ?? unit.replaceAll('_', ' ') : 'unit not reported';
}

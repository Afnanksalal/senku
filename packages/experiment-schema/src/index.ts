import { z } from 'zod';
export const serviceHealthSchema = z.object({ status: z.literal('ok'), service: z.string() });
export type ServiceHealth = z.infer<typeof serviceHealthSchema>;

export const scientificStatus = z.enum([
  'illustrative_educational',
  'validated_prediction',
  'literature_value',
  'measured_data',
]);
export const runStatus = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'timed_out',
]);
export const engineId = z.enum([
  'numerics',
  'roadrunner',
  'tellurium',
  'copasi',
  'cobrapy',
  'physicell',
  'rdkit',
]);
export const identifier = z.string().regex(/^[a-z][a-z0-9-]{1,63}$/);
export const version = z.string().regex(/^\d+\.\d+\.\d+$/);
export const parameterSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('number'),
    unit: z.string(),
    min: z.number().finite(),
    max: z.number().finite(),
    default: z.number().finite(),
    integer: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('enum'),
    unit: z.literal('dimensionless'),
    values: z.array(z.string()).min(1).max(20),
    default: z.string(),
  }),
  z.object({
    type: z.literal('text'),
    unit: z.literal('SMILES'),
    max_length: z.number().int().min(1).max(256),
    default: z.string().min(1).max(256),
  }),
]);
export const referenceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
});
export const experimentSchema = z.object({
  schema_version: z.literal('1.0.0'),
  id: identifier,
  version,
  subject: z.string(),
  name: z.string(),
  description: z.string(),
  model: z.object({
    id: identifier,
    version,
    scientific_status: scientificStatus,
    assumptions: z.array(z.string()),
    equations: z.array(z.string()),
    limitations: z.array(z.string()),
    references: z.array(referenceSchema),
  }),
  engine: z.object({
    id: engineId,
    adapter_version: version,
    timeout_seconds: z.number().int().min(1).max(120),
  }),
  parameters: z.record(z.string(), parameterSchema),
  outputs: z.array(
    z.object({
      id: z.string(),
      type: z.enum([
        'scalar',
        'time_series',
        'matrix',
        'spatial_frame',
        'molecule',
        'network',
        'document',
        'table',
      ]),
      unit: z.string(),
    }),
  ),
  learning: z.object({ objective: z.string(), concept: z.string() }),
  modes: z.array(z.enum(['learn', 'lab', 'challenge', 'discover'])),
  local_capable: z.boolean(),
  safety: z.object({ class: z.literal('approved_educational'), user_code: z.literal(false) }),
});
export type Experiment = z.infer<typeof experimentSchema>;
export type Parameters = Record<string, number | string>;
export function validateParameters(
  manifest: Experiment,
  input: Record<string, unknown>,
): Parameters {
  const result: Parameters = {};
  for (const name of Object.keys(input))
    if (!Object.hasOwn(manifest.parameters, name)) throw new Error(`Unknown parameter: ${name}`);
  for (const [name, p] of Object.entries(manifest.parameters)) {
    const value = input[name] ?? p.default;
    if (p.type === 'number') {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < p.min ||
        value > p.max ||
        (p.integer && !Number.isInteger(value))
      )
        throw new Error(`Invalid parameter: ${name}`);
    } else if (p.type === 'enum') {
      if (typeof value !== 'string' || !p.values.includes(value))
        throw new Error(`Invalid parameter: ${name}`);
    } else if (
      typeof value !== 'string' ||
      !value.length ||
      value.length > p.max_length ||
      /[\u0000-\u001f]/.test(value)
    )
      throw new Error(`Invalid parameter: ${name}`);
    result[name] = value as number | string;
  }
  return result;
}
export const pathwaySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    species: z
      .array(
        z
          .object({ id: z.string().regex(/^S[0-9]{1,3}$/), initial_mM: z.number().min(0).max(100) })
          .strict(),
      )
      .min(1)
      .max(24),
    reactions: z
      .array(
        z
          .object({
            id: z.string().regex(/^R[0-9]{1,3}$/),
            reactants: z
              .array(
                z
                  .object({
                    species: z.string().regex(/^S[0-9]{1,3}$/),
                    stoichiometry: z.number().int().min(1).max(4),
                  })
                  .strict(),
              )
              .max(4),
            products: z
              .array(
                z
                  .object({
                    species: z.string().regex(/^S[0-9]{1,3}$/),
                    stoichiometry: z.number().int().min(1).max(4),
                  })
                  .strict(),
              )
              .max(4),
            rate_constant: z.number().finite().min(0).max(10),
          })
          .strict(),
      )
      .min(1)
      .max(32),
  })
  .strict();
export type Pathway = z.infer<typeof pathwaySchema>;
export function validatePathway(graph: Pathway): void {
  const species = new Set(graph.species.map((s) => s.id));
  if (
    species.size !== graph.species.length ||
    new Set(graph.reactions.map((r) => r.id)).size !== graph.reactions.length
  )
    throw new Error('Duplicate component identifier');
  for (const r of graph.reactions) {
    if (!r.reactants.length && !r.products.length) throw new Error('Reaction has no components');
    for (const side of [r.reactants, r.products]) {
      if (new Set(side.map((s) => s.species)).size !== side.length)
        throw new Error('Duplicate species within a reaction side');
      if (side.some((s) => !species.has(s.species))) throw new Error('Unknown reaction species');
    }
    if (r.reactants.reduce((s, p) => s + p.stoichiometry, 0) > 4)
      throw new Error('Reaction order exceeds educational limit');
  }
}
export function compileSbml(graph: Pathway): string {
  validatePathway(graph);
  const species = graph.species
    .map(
      (s) =>
        `<species id="${s.id}" compartment="cell" initialConcentration="${s.initial_mM}" substanceUnits="substance" boundaryCondition="false" constant="false" hasOnlySubstanceUnits="false"/>`,
    )
    .join('');
  const definitions = [
    '<unitDefinition id="substance"><listOfUnits><unit kind="mole" scale="-3" multiplier="1" exponent="1"/></listOfUnits></unitDefinition>',
    '<unitDefinition id="time"><listOfUnits><unit kind="second" multiplier="60" exponent="1"/></listOfUnits></unitDefinition>',
    ...graph.reactions.map((r, i) => {
      const order = r.reactants.reduce((sum, s) => sum + s.stoichiometry, 0);
      return `<unitDefinition id="rate${i}"><listOfUnits><unit kind="mole" scale="-3" exponent="${1 - order}"/><unit kind="litre" exponent="${order - 1}"/><unit kind="second" multiplier="60" exponent="-1"/></listOfUnits></unitDefinition>`;
    }),
  ].join('');
  const parameters = graph.reactions
    .map(
      (r, i) =>
        `<parameter id="k${i}" value="${r.rate_constant}" units="rate${i}" constant="true"/>`,
    )
    .join('');
  const reactions = graph.reactions
    .map((r, i) => {
      const side = (name: string, list: typeof r.reactants) =>
        list.length
          ? `<listOf${name}>${list.map((p) => `<speciesReference species="${p.species}" stoichiometry="${p.stoichiometry}"/>`).join('')}</listOf${name}>`
          : '';
      const terms = [
        `<ci>k${i}</ci>`,
        `<ci>cell</ci>`,
        ...r.reactants.map((s) =>
          s.stoichiometry === 1
            ? `<ci>${s.species}</ci>`
            : `<apply><power/><ci>${s.species}</ci><cn>${s.stoichiometry}</cn></apply>`,
        ),
      ];
      return `<reaction id="${r.id}" reversible="false">${side('Reactants', r.reactants)}${side('Products', r.products)}<kineticLaw><math xmlns="http://www.w3.org/1998/Math/MathML"><apply><times/>${terms.join('')}</apply></math></kineticLaw></reaction>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><sbml xmlns="http://www.sbml.org/sbml/level2/version4" level="2" version="4"><model id="educational_pathway"><listOfUnitDefinitions>${definitions}</listOfUnitDefinitions><listOfCompartments><compartment id="cell" size="1" units="litre" constant="true"/></listOfCompartments><listOfSpecies>${species}</listOfSpecies><listOfParameters>${parameters}</listOfParameters><listOfReactions>${reactions}</listOfReactions></model></sbml>`;
}
export function localScalars(
  experiment: string,
  parameters: Parameters,
  seed = 0,
): Record<string, number> {
  const n = (key: string) => Number(parameters[key]);
  if (experiment === 'cell-energy')
    return {
      energy_index: Math.min(100, (Math.min(n('oxygen'), n('glucose')) / n('demand')) * 100),
    };
  if (experiment === 'enzyme-explorer')
    return { initial_rate: (n('vmax') * n('substrate_mM')) / (n('km_mM') + n('substrate_mM')) };
  if (experiment === 'population-dynamics') {
    const initial = n('initial_population'),
      capacity = n('capacity');
    return {
      final_population:
        initial === 0
          ? 0
          : capacity / (1 + (capacity / initial - 1) * Math.exp(-n('growth_rate') * n('duration'))),
    };
  }
  if (experiment === 'genetics-lab') {
    let state = seed >>> 0;
    const random = () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const p1 = String(parameters.parent1),
      p2 = String(parameters.parent2);
    const result = { AA: 0, Aa: 0, aa: 0 };
    for (let i = 0; i < n('sample_size'); i++) {
      const pair = [p1[Math.floor(random() * 2)], p2[Math.floor(random() * 2)]]
        .sort()
        .join('') as keyof typeof result;
      result[pair]++;
    }
    return result;
  }
  throw new Error('Experiment has no offline verification kernel');
}

/** Adapter input requirement shared by API and UI without changing immutable model data. */
export function requiresPathway(experiment: Pick<Experiment, 'id'>): boolean {
  return experiment.id === 'pathway-playground';
}

/** Units of the verified scalar kernels. No quantities or trajectories are fabricated. */
export function localUnits(experiment: string | Pick<Experiment, 'id'>): Record<string, string> {
  const id = typeof experiment === 'string' ? experiment : experiment.id;
  if (id === 'cell-energy') return { energy_index: 'normalized_index_percent' };
  if (id === 'enzyme-explorer') return { initial_rate: 'mM/min' };
  if (id === 'population-dynamics') return { final_population: 'individuals' };
  if (id === 'genetics-lab') return { AA: 'offspring', Aa: 'offspring', aa: 'offspring' };
  return {};
}

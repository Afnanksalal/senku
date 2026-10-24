'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export type Challenge = {
  id: string;
  lesson_id: string;
  definition: { name: string; experiment_id: string; experiment_version: string; metric: string; minimum: number; xp: number };
};
export type ChallengeScore = { passed: boolean; metric: number; xp_awarded: number };

export const useChallenges = () => useQuery({ queryKey: ['challenges'], queryFn: () => api<Challenge[]>('/v1/challenges'), staleTime: 60_000 });

export const games = [
  { id: 'restore-cell', experiment: 'cell-energy', name: 'Restore the Cell', subtitle: 'Find the bottleneck', description: 'Balance oxygen, glucose and demand to restore the model cell’s energy index.', tactic: 'Adding more of a resource cannot help while the other resource is limiting.', metric: 'energy_index', target: 60, stain: 'chlorophyll', initial: { oxygen: 10, glucose: 20, demand: 80 } },
  { id: 'enzyme-saturation', experiment: 'enzyme-explorer', name: 'Reaction Rush', subtitle: 'Explore saturation', description: 'Reach the target reaction rate by changing the conditions of a Michaelis–Menten model.', tactic: 'Substrate has diminishing returns. Compare its effect with Vmax and Km.', metric: 'initial_rate', target: .8, stain: 'hema', initial: { substrate_mM: .5, vmax: 1, km_mM: 2, duration: 10 } },
  { id: 'population-recovery', experiment: 'population-dynamics', name: 'Population Rescue', subtitle: 'Think in growth curves', description: 'Help a model population reach its target while respecting carrying capacity.', tactic: 'Time and growth rate interact. A population starting at zero stays at zero in this model.', metric: 'final_population', target: 800, stain: 'cobalt', initial: { initial_population: 50, capacity: 1000, growth_rate: .1, duration: 10 } },
  { id: 'genetics-dominance', experiment: 'genetics-lab', name: 'Allele Architect', subtitle: 'Try a genetic cross', description: 'Choose parental genotypes and sample a generation with enough AA offspring.', tactic: 'Each parent contributes one sampled allele. A seed makes the sample reproducible.', metric: 'AA', target: 70, stain: 'eosin', initial: { parent1: 'Aa', parent2: 'Aa', sample_size: 100 } },
] as const;
export type Game = typeof games[number];

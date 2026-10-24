'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Parameters } from '@senku/experiment-schema';

export type Challenge = {
  id: string;
  lesson_id: string;
  definition: { name: string; experiment_id: string; experiment_version: string; metric: string; minimum: number; xp: number };
};
export type ChallengeScore = { passed: boolean; metric: number; xp_awarded: number };
export type ChallengeDifficulty = 'gentle' | 'curious' | 'stretch';
export type DynamicScenario = {
  id: string;
  status: 'completed';
  challenge_id: string;
  experiment_id: string;
  experiment_version: string;
  title: string;
  story: string;
  goal_text: string;
  hint: string;
  controls: { key: string; label: string; low_label: string; high_label: string }[];
  parameters: Parameters;
  seed: number;
  goal: { metric: string; operator: 'gte' | 'lte'; value: number };
  xp: number;
  source: 'gemini' | 'fallback';
  reason?: string;
};
export type ScenarioRecord = { id: string; status: 'queued' | 'running' | 'failed' | 'completed'; error_code?: string } & Partial<Omit<DynamicScenario, 'status'>>;
export type ChallengeExplanation = { explanation: string; hint: string; source: 'gemini' | 'fallback'; status?: 'queued' | 'running' | 'completed' | 'failed' };

export function isScenarioComplete(record: ScenarioRecord | undefined): record is DynamicScenario {
  return record?.status === 'completed' && !!record.title && !!record.goal && !!record.parameters && Array.isArray(record.controls);
}

export const friendlyControls: Record<string, { label: string; low: string; high: string }> = {
  oxygen: { label: 'Oxygen supply', low: 'Less oxygen', high: 'More oxygen' },
  glucose: { label: 'Food for the cell', low: 'Less food', high: 'More food' },
  demand: { label: 'How hard the cell works', low: 'Resting', high: 'Working hard' },
  substrate_mM: { label: 'Food for the reaction', low: 'A little', high: 'Plenty' },
  vmax: { label: 'Enzyme capacity', low: 'Less capacity', high: 'More capacity' },
  km_mM: { label: 'How easily the enzyme binds', low: 'Easier binding', high: 'Harder binding' },
  initial_population: { label: 'Starting population', low: 'A small group', high: 'A larger group' },
  capacity: { label: 'Space and resources', low: 'Less room', high: 'More room' },
  growth_rate: { label: 'Pace of growth', low: 'Slower', high: 'Faster' },
  duration: { label: 'Time to grow', low: 'A shorter wait', high: 'A longer wait' },
  parent1: { label: 'First parent', low: '', high: '' },
  parent2: { label: 'Second parent', low: '', high: '' },
  sample_size: { label: 'Size of the new generation', low: 'A smaller sample', high: 'A larger sample' },
};

export const useChallenges = () => useQuery({ queryKey: ['challenges'], queryFn: () => api<Challenge[]>('/v1/challenges'), staleTime: 60_000 });

export const games = [
  { id: 'restore-cell', experiment: 'cell-energy', name: 'Restore the Cell', subtitle: 'Find the bottleneck', description: 'Help a cell get the food and oxygen it needs.', tactic: 'A cell needs both food and oxygen. Whichever runs short holds it back.', metric: 'energy_index', target: 60, stain: 'chlorophyll', initial: { oxygen: 10, glucose: 20, demand: 80 } },
  { id: 'enzyme-saturation', experiment: 'enzyme-explorer', name: 'Reaction Rush', subtitle: 'Explore saturation', description: 'Give an enzyme what it needs and see how fast it can work.', tactic: 'More starting material helps at first. Watch for a point where adding more barely changes the speed.', metric: 'initial_rate', target: .8, stain: 'hema', initial: { substrate_mM: .5, vmax: 1, km_mM: 2, duration: 10 } },
  { id: 'population-recovery', experiment: 'population-dynamics', name: 'Population Rescue', subtitle: 'Think in growth curves', description: 'Give a small model population the time and room it needs to recover.', tactic: 'Time and growth rate interact. A population starting at zero stays at zero in this model.', metric: 'final_population', target: 800, stain: 'cobalt', initial: { initial_population: 50, capacity: 1000, growth_rate: .1, duration: 10 } },
  { id: 'genetics-dominance', experiment: 'genetics-lab', name: 'Allele Architect', subtitle: 'Try a genetic cross', description: 'Choose parent pairs and see which A and a copies appear in the next generation.', tactic: 'Each parent contributes one sampled allele. A seed makes the sample reproducible.', metric: 'AA', target: 70, stain: 'eosin', initial: { parent1: 'Aa', parent2: 'Aa', sample_size: 100 } },
] as const;
export type Game = typeof games[number];

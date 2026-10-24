'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useSession, type User } from './session';

export type AccountProfile = User & { timezone: string };
export type LearningProgress = {
  xp: number;
  concepts: { concept: string; attempts: number; score: number }[];
  achievements: { id: string; name: string; created_at: string }[];
  lessons: { reward_key: string; created_at: string }[];
  streak: { days: number; basis: string };
};
export type LearningGoal = { daily_xp_goal: number; updated_at: string | null; is_default: boolean };
export type ActivityDay = {
  day: string; earned_xp: number; activity_count: number; lesson_attempts: number;
  challenge_attempts: number; runs_started: number; investigations_started: number; questions_asked: number;
};
export type ActivityEntry = {
  id: string; kind: 'lesson' | 'challenge' | 'run' | 'investigation' | 'question';
  resource_id: string; resource_version: string | null; title: string; status: string; earned_xp: number; created_at: string;
};
export type AccountActivity = {
  day_basis: 'UTC'; today: string; days: ActivityDay[]; history: ActivityEntry[]; history_limit: number;
  totals: { lesson_attempts: number; challenge_attempts: number; runs_started: number; runs_completed: number; investigations_started: number; questions_asked: number };
  source: string;
};
export function learningLevel(xp: number) {
  const earned = Math.max(0, xp);
  return { level: Math.floor(earned / 100) + 1, current: earned % 100, target: 100, untilNext: 100 - (earned % 100) };
}
function useAccountEnabled() { const user = useSession((s) => s.user); return { id: user?.id, enabled: !!user && user.role !== 'guest' }; }
export function useAccountProfile() { const a = useAccountEnabled(); return useQuery({ queryKey: ['profile', a.id], queryFn: () => api<AccountProfile>('/v1/me', { auth: true }), enabled: a.enabled, staleTime: 30_000 }); }
export function useLearningProgress() { const a = useAccountEnabled(); return useQuery({ queryKey: ['progress', a.id], queryFn: () => api<LearningProgress>('/v1/me/progress', { auth: true }), enabled: a.enabled, staleTime: 15_000 }); }
export function useAccountActivity() { const a = useAccountEnabled(); return useQuery({ queryKey: ['activity', a.id], queryFn: () => api<AccountActivity>('/v1/me/activity', { auth: true }), enabled: a.enabled, staleTime: 15_000 }); }
export function useLearningGoal() { const a = useAccountEnabled(); return useQuery({ queryKey: ['learning-goal', a.id], queryFn: () => api<LearningGoal>('/v1/me/learning-goal', { auth: true }), enabled: a.enabled, staleTime: 60_000 }); }

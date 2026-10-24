import type { CatalogExperiment } from './api';

export type CompanionAnswer = {
  explanation: string;
  reflection_question: string;
  suggested_parameter: string | null;
  ai_generated: true;
  requires_review: true;
  model: string;
};
export type CompanionResponse = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  response: CompanionAnswer | null;
  error_code: string | null;
};
export type ChatEntry = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  answer?: CompanionAnswer;
};
export type CompanionRequest = {
  key: string;
  id?: string;
  body: {
    message: string;
    experiment_id: string;
    experiment_version: string;
    run_id?: string;
    local?: { parameters: import('./runs').RunRecord['parameters']; seed: number };
    history: { role: 'user' | 'assistant'; text: string }[];
  };
};
export type Conversation = { entries: ChatEntry[]; pending?: CompanionRequest };

/** Display and context are both bounded. Storage contains no bearer credentials. */
export function readConversation(key: string): Conversation {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!value || typeof value !== 'object') return { entries: [] };
    const data = value as Conversation;
    const entries = Array.isArray(data.entries) ? data.entries.filter((e) =>
      e && typeof e.id === 'string' && (e.role === 'user' || e.role === 'assistant') && typeof e.text === 'string',
    ).slice(-16).map((e) => ({ ...e, text: e.text.slice(0, 5000) })) : [];
    const pending = data.pending && typeof data.pending.key === 'string' && typeof data.pending.body?.message === 'string'
      ? data.pending : undefined;
    return { entries, pending };
  } catch { return { entries: [] }; }
}

export function approvedSuggestion(experiment: CatalogExperiment, answer?: CompanionAnswer): string | null {
  return answer?.suggested_parameter && Object.hasOwn(experiment.parameters, answer.suggested_parameter)
    ? answer.suggested_parameter : null;
}

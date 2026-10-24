import type { Parameters } from '@senku/experiment-schema';

export type Room = {
  id: string;
  owner_id: string;
  experiment_id: string;
  experiment_version: string;
  parameters: Parameters;
  version: number;
  last_run_id: string | null;
  closed_at?: string | null;
  created_at?: string;
  role: 'owner' | 'editor' | 'viewer';
};
export type RoomMember = { user_id: string; role: 'owner' | 'editor' | 'viewer'; display_name: string };
export type Share = { id: string; resource_type: 'run' | 'room' | 'investigation'; resource_id: string; role: 'viewer' | 'editor'; expires_at: string; revoked_at?: string | null; token?: string };
export type RoomEvent = { sequence: string; type: string; payload: { version?: number; parameters?: Parameters; actor_id?: string; user_id?: string } };
export type SharedResource = { type: 'run' | 'room' | 'investigation'; role: 'viewer' | 'editor'; resource: Record<string, unknown> };

export function shareToken(input: string): string | null {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(value)) return value;
  try { const path = new URL(value).pathname.split('/').filter(Boolean); const result = path.at(-1); return path.at(-2) === 'shared' && result && /^[A-Za-z0-9_-]{43}$/.test(result) ? result : null; } catch { return null; }
}

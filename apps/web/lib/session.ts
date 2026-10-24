import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type User = { id: string; role: 'guest' | 'learner' | 'teacher' | 'admin'; display_name: string; email: string | null };
export type AuthResponse = { user: User; access_token: string; refresh_token: string; expires_in: number };
type Tokens = { access_token: string; refresh_token: string; expires_at: number };

type SessionState = {
  user?: User;
  tokens?: Tokens;
  signIn: (auth: AuthResponse) => string;
  signOut: () => void;
};

// ponytail: bearer tokens live in localStorage because the API issues bearer tokens, not cookies. Move to httpOnly cookies if the API adds them.
export const useSession = create<SessionState>()(persist((set) => ({
  signIn: (auth) => {
    set({ user: auth.user, tokens: { access_token: auth.access_token, refresh_token: auth.refresh_token, expires_at: Date.now() + auth.expires_in * 1000 } });
    return auth.access_token;
  },
  signOut: () => set({ user: undefined, tokens: undefined }),
}), { name: 'senku-session' }));

import { create } from "zustand";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

export type Session = {
  user: SessionUser;
  accessToken: string | null;
};

type SessionState = {
  session: Session | null;
  setSession: (session: Session) => void;
  clearSession: () => void;
};

/**
 * In memory only: access tokens must not live in localStorage.
 * The auth phase will restore the session on load via the refresh-token cookie.
 */
export const useSessionStore = create<SessionState>()((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  clearSession: () => set({ session: null }),
}));

import type { UserProfile } from "@automate/shared";
import { create } from "zustand";

export type Session = {
  user: UserProfile;
  accessToken: string;
};

/** `unknown` until the start-up refresh has run; routes wait for it before deciding. */
export type SessionStatus = "unknown" | "authenticated" | "anonymous";

type SessionState = {
  status: SessionStatus;
  session: Session | null;
  setSession: (session: Session) => void;
  clearSession: () => void;
};

/**
 * In memory only: access tokens must not live in localStorage. A page load restores the
 * session through the httpOnly refresh cookie (see `refreshSession` in lib/api-client).
 */
export const useSessionStore = create<SessionState>()((set) => ({
  status: "unknown",
  session: null,
  setSession: (session) => set({ session, status: "authenticated" }),
  clearSession: () => set({ session: null, status: "anonymous" }),
}));

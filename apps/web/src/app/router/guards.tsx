import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";

import { LoadingState } from "@/components/feedback/loading-state";
import { refreshSession } from "@/lib/api-client";
import { useSessionStore } from "@/stores/session-store";

/** Root route: restores the session from the refresh cookie once, before any guard decides. */
export function SessionGate() {
  const status = useSessionStore((state) => state.status);

  useEffect(() => {
    if (status === "unknown") void refreshSession();
  }, [status]);

  if (status === "unknown") return <LoadingState fullScreen label="Loading AutoMate…" />;
  return <Outlet />;
}

/** Authenticated routes. Remembers where the user was headed so sign-in can return there. */
export function RequireAuth() {
  const isSignedIn = useSessionStore((state) => state.status === "authenticated");
  const location = useLocation();

  if (!isSignedIn) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Sign-in and registration. A signed-in user (including one who just signed in) moves on. */
export function RequireGuest() {
  const isSignedIn = useSessionStore((state) => state.status === "authenticated");
  const from = (useLocation().state as { from?: { pathname?: string } } | null)?.from?.pathname;

  if (isSignedIn) return <Navigate to={from ?? "/dashboard"} replace />;
  return <Outlet />;
}

import { Navigate, Outlet, useLocation } from "react-router";

import { useSessionStore } from "@/stores/session-store";

/** Gate for authenticated routes; remembers where the user was headed. */
export function RequireAuth() {
  const hasSession = useSessionStore((state) => state.session !== null);
  const location = useLocation();

  if (!hasSession) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

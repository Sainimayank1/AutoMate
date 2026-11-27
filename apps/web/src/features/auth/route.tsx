import { CarFront } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSessionStore } from "@/stores/session-store";

/** Phase 0 placeholder. Real sign-in arrives with the auth phase. */
export function Component() {
  const hasSession = useSessionStore((state) => state.session !== null);
  const setSession = useSessionStore((state) => state.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  if (hasSession) return <Navigate to={from ?? "/dashboard"} replace />;

  function continueAsDeveloper() {
    // shortcut: dev-only stand-in session; delete when real auth lands.
    setSession({
      user: { id: "dev", name: "Developer", email: "dev@automate.local" },
      accessToken: null,
    });
    navigate(from ?? "/dashboard", { replace: true });
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CarFront className="size-5" />
          </div>
          <CardTitle className="font-heading text-xl">Sign in to AutoMate</CardTitle>
          <CardDescription>
            Sign-in will be available once the AutoMate API is ready.
          </CardDescription>
        </CardHeader>
        {import.meta.env.DEV && (
          <>
            <CardContent className="text-center text-sm text-muted-foreground">
              Development build: continue with a temporary local session.
            </CardContent>
            <CardFooter>
              <Button className="w-full" size="lg" onClick={continueAsDeveloper}>
                Continue to app
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </main>
  );
}

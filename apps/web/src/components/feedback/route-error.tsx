import { FileQuestion, RotateCw, TriangleAlert } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

export function NotFoundState() {
  return (
    <EmptyState
      className="min-h-[60svh]"
      icon={FileQuestion}
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      action={
        <Button asChild>
          <Link to="/dashboard">Go to dashboard</Link>
        </Button>
      }
    />
  );
}

/** Route `errorElement`: render errors and failed lazy loads without exposing internals. */
export function RouteError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundState />;

  console.error(error);
  return (
    <EmptyState
      className="min-h-[60svh]"
      icon={TriangleAlert}
      title="This page couldn't be loaded"
      description="Something went wrong while showing this page. Please try again."
      action={
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RotateCw data-icon="inline-start" />
          Reload
        </Button>
      }
    />
  );
}

import { RotateCw, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api-error";

type ErrorStateProps = {
  title?: string;
  /** Any thrown value; only its user-safe message is shown. */
  error?: unknown;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = "Something went wrong",
  error,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <EmptyState
      className={className}
      icon={TriangleAlert}
      title={title}
      description={normalizeApiError(error).message}
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RotateCw data-icon="inline-start" />
            Try again
          </Button>
        )
      }
    />
  );
}

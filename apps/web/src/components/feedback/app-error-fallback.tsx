import { RotateCw, TriangleAlert } from "lucide-react";
import type { FallbackProps } from "react-error-boundary";

import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

/** Last-resort screen when the app itself crashes (outside the router). */
export function AppErrorFallback({ error }: FallbackProps) {
  console.error(error);
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <EmptyState
        icon={TriangleAlert}
        title="AutoMate ran into a problem"
        description="Reload the page to try again. If it keeps happening, please contact support."
        action={
          <Button onClick={() => window.location.reload()}>
            <RotateCw data-icon="inline-start" />
            Reload
          </Button>
        }
      />
    </div>
  );
}

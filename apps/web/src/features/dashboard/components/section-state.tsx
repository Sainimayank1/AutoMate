import type { DashboardSection } from "@automate/shared";
import { cn } from "cn";
import { RotateCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

/**
 * One dashboard section: its content, its empty state, or its own error with a retry. A section
 * that fails never hides the others (docs/architecture/dashboard.md §1).
 */
export function SectionState<T>({
  section,
  onRetry,
  empty = null,
  className,
  children,
}: {
  section: DashboardSection<T>;
  onRetry: () => void;
  empty?: ReactNode;
  className?: string;
  children: (data: T) => ReactNode;
}) {
  if (section.state === "ok") return children(section.data);
  if (section.state === "empty") return empty;
  return (
    <EmptyState
      className={cn("rounded-xl border", className)}
      icon={TriangleAlert}
      title={section.message}
      action={
        <Button variant="outline" onClick={onRetry}>
          <RotateCw data-icon="inline-start" />
          Try again
        </Button>
      }
    />
  );
}

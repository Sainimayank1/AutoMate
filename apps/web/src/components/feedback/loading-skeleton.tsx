import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";

type LoadingSkeletonProps = {
  /** Number of list rows to show. */
  rows?: number;
  className?: string;
};

/** Placeholder for list/detail content while the first fetch is in flight. */
export function LoadingSkeleton({ rows = 3, className }: LoadingSkeletonProps) {
  return (
    <div role="status" aria-label="Loading" className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

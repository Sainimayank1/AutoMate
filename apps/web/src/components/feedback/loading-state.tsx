import { cn } from "cn";

import { Spinner } from "@/components/ui/spinner";

type LoadingStateProps = {
  label?: string;
  /** Fill the viewport, for app start-up. */
  fullScreen?: boolean;
  className?: string;
};

export function LoadingState({ label = "Loading…", fullScreen, className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground",
        fullScreen && "min-h-svh py-0",
        className,
      )}
    >
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

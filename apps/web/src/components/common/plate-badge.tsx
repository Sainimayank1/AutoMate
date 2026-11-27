import { cn } from "cn";

import { formatRegistration } from "@/utils/format";

/** Registration plate chip (Stitch: Geist Mono on a raised tile), e.g. HR-26-EV-4821. */
export function PlateBadge({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border bg-elevated px-2 py-0.5 font-mono text-xs font-medium tracking-wide whitespace-nowrap text-foreground tabular-nums",
        className,
      )}
    >
      {formatRegistration(value)}
    </span>
  );
}

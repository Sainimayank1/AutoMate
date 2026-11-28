import { cn } from "cn";

import { formatRegistration } from "@/utils/format";

/**
 * The theme's signature: the registration set like an Indian number plate (white plate, black
 * mono letters, the blue IND strip as a band in the accent). Use it wherever a vehicle is named
 * by its plate and nowhere else.
 */
export function PlateBadge({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-sm border border-plate-foreground/15 bg-plate font-mono text-xs font-medium whitespace-nowrap text-plate-foreground tabular-nums",
        className,
      )}
    >
      <span className="w-1 bg-brand" aria-hidden />
      <span className="px-1.5 py-0.5">{formatRegistration(value)}</span>
    </span>
  );
}

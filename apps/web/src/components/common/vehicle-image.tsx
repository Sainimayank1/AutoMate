import { cn } from "cn";
import { Car } from "lucide-react";
import type { ReactNode } from "react";

type VehicleImageProps = {
  make: string;
  model: string;
  /** `thumb`: 40px tile for switchers and lists; `panel`: fills its container (cards, heroes). */
  variant?: "thumb" | "panel";
  className?: string;
  /** Show the make and model under the icon. Turn off when the caller overlays the name itself. */
  showLabel?: boolean;
  /** Overlays (status badge, plate) positioned by the caller. */
  children?: ReactNode;
};

/**
 * Vehicle visual. Photos aren't supported yet (they arrive with secure file storage), so this is the
 * design-system fallback: a graphite panel with the cyan glow, a thin car outline and the make and model.
 */
export function VehicleImage({
  make,
  model,
  variant = "panel",
  className,
  showLabel = true,
  children,
}: VehicleImageProps) {
  if (variant === "thumb") {
    return (
      <span
        className={cn(
          "hero-glow flex size-10 shrink-0 items-center justify-center rounded-md border bg-elevated",
          className,
        )}
        aria-hidden
      >
        <Car className="size-5 text-muted-foreground" strokeWidth={1.5} />
      </span>
    );
  }

  return (
    <div className={cn("hero-glow relative isolate overflow-hidden bg-elevated", className)}>
      <div
        className="absolute inset-0 -z-10 flex flex-col items-center justify-center gap-2 text-muted-foreground"
        aria-hidden
      >
        <Car className="size-16 opacity-60" strokeWidth={1} />
        {showLabel && (
          <span className="text-xs font-semibold tracking-wider uppercase opacity-70">
            {make} {model}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

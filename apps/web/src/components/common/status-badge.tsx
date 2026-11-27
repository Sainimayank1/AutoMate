import { cn } from "cn";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export type StatusTone = "destructive" | "warning" | "info" | "success" | "neutral";

const TONES: Record<StatusTone, string> = {
  destructive: "border-transparent bg-destructive/15 text-destructive",
  warning: "border-transparent bg-warning/15 text-warning",
  info: "border-transparent bg-info/15 text-info",
  success: "border-transparent bg-success/15 text-success",
  neutral: "text-muted-foreground",
};

/** A status as colour + icon + label, never colour alone (color-system.md "Status recipes"). */
export function StatusBadge({
  tone,
  icon: Icon,
  label,
  className,
}: {
  tone: StatusTone;
  icon: LucideIcon;
  label: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(TONES[tone], className)}>
      <Icon data-icon="inline-start" aria-hidden />
      {label}
    </Badge>
  );
}

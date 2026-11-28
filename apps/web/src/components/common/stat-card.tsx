import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type StatCardProps = {
  label: string;
  /** Pre-formatted value, e.g. formatCurrency(total). */
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  /** Makes the whole card a link to the module behind the number. */
  href?: string;
  loading?: boolean;
  className?: string;
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  loading,
  className,
}: StatCardProps) {
  const card = (
    <Card
      className={cn(
        "h-full",
        href &&
          "transition-colors group-hover/stat:bg-muted/50 group-focus-visible/stat:ring-2 group-focus-visible/stat:ring-ring",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="truncate">{label}</span>
          {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className="font-heading text-2xl font-medium tabular-nums">{value}</div>
        )}
        {hint && !loading && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link to={href} className="group/stat rounded-xl outline-none">
      {card}
    </Link>
  ) : (
    card
  );
}

import { ArrowLeft, X } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

type TaskPageProps = {
  /** Browser tab and h1. */
  title: string;
  /** Shorter h1 on phones (Stitch mobile: "Add vehicle"). */
  mobileTitle?: string;
  /** Phones show a close (X) instead of a back arrow: leaving abandons the flow. */
  closeOnMobile?: boolean;
  subtitle?: ReactNode;
  backTo: string;
  backLabel: string;
  /** Header actions (Cancel, Save…). */
  actions?: ReactNode;
  /** Full-width strip under the header (the wizard's step rail). */
  banner?: ReactNode;
  children: ReactNode;
};

/**
 * Full-page task flow outside the app shell (Stitch "Add Vehicle Wizard" / "Edit Vehicle"):
 * a focused header with a back button, no sidebar.
 */
export function TaskPage({
  title,
  mobileTitle,
  closeOnMobile,
  subtitle,
  backTo,
  backLabel,
  actions,
  banner,
  children,
}: TaskPageProps) {
  return (
    <div className="flex min-h-svh flex-col">
      <title>{`${title} · AutoMate`}</title>
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card px-4 md:h-16 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" className="size-10 shrink-0 md:size-9" asChild>
            <Link to={backTo} aria-label={backLabel}>
              {closeOnMobile ? (
                <>
                  <X className="md:hidden" />
                  <ArrowLeft className="max-md:hidden" />
                </>
              ) : (
                <ArrowLeft />
              )}
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-base font-semibold">
              {mobileTitle ? (
                <>
                  <span className="md:hidden">{mobileTitle}</span>
                  <span className="max-md:hidden">{title}</span>
                </>
              ) : (
                title
              )}
            </h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {banner}
      <main className="flex-1">{children}</main>
    </div>
  );
}

import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";

import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { QuickAddMenu } from "@/components/layout/quick-add";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { HeaderVehicleSelector } from "@/components/layout/vehicle-selector";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";

export function AppHeader() {
  const crumbs = useBreadcrumbs();
  const title = crumbs.at(-1)?.title;
  // Inner pages go back to their parent; module roots switch vehicle (phones only).
  const parent = crumbs.length > 1 ? crumbs.at(-2) : undefined;

  useEffect(() => {
    document.title = title ? `${title} · AutoMate` : "AutoMate";
  }, [title]);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 md:h-16 items-center gap-2 border-b bg-background/80 px-2 backdrop-blur supports-backdrop-filter:bg-background/60 md:px-4">
      {/* Phones open the full nav from the bottom bar's "More". */}
      <SidebarTrigger className="hidden size-8 md:inline-flex" />
      <Separator
        orientation="vertical"
        className="mr-1 hidden data-vertical:h-4 data-vertical:self-center md:block"
      />
      <Breadcrumbs className="hidden min-w-0 md:block" />
      <div className="flex min-w-0 items-center gap-1 md:hidden">
        {parent ? (
          <>
            <Button variant="ghost" size="icon" className="size-10 shrink-0" asChild>
              <Link to={parent.path} aria-label={`Back to ${parent.title}`}>
                <ArrowLeft />
              </Link>
            </Button>
            <span className="truncate font-heading font-semibold">{title}</span>
          </>
        ) : (
          <HeaderVehicleSelector
            fallback={<span className="truncate font-heading font-semibold">{title}</span>}
          />
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <QuickAddMenu />
        <NotificationBell />
        <ThemeToggle className="hidden md:inline-flex" />
        <UserMenu />
      </div>
    </header>
  );
}

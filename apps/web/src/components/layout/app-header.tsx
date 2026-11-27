import { Bell } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";

import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";

export function AppHeader() {
  const title = useBreadcrumbs().at(-1)?.title;

  useEffect(() => {
    document.title = title ? `${title} · AutoMate` : "AutoMate";
  }, [title]);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 md:h-16 items-center gap-2 border-b bg-background/80 px-2 backdrop-blur supports-backdrop-filter:bg-background/60 md:px-4">
      <SidebarTrigger className="size-10 md:size-8" />
      <Separator
        orientation="vertical"
        className="mr-1 data-vertical:h-4 data-vertical:self-center"
      />
      <Breadcrumbs className="hidden min-w-0 md:block" />
      <span className="truncate font-heading font-semibold md:hidden">{title}</span>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-10 md:size-8" asChild>
          <Link to="/notifications" aria-label="Notifications">
            <Bell />
          </Link>
        </Button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

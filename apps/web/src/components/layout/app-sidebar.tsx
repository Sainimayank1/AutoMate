import { CarFront } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router";

import { type AppModule, appModules, NAV_GROUP_LABELS, type NavGroup } from "@/app/modules";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

const PRIMARY_GROUPS: NavGroup[] = ["overview", "vehicle", "insights"];

function NavItems({ modules }: { modules: readonly AppModule[] }) {
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      {modules.map((item) => (
        <SidebarMenuItem key={item.id}>
          <SidebarMenuButton
            asChild
            isActive={pathname === item.path || pathname.startsWith(`${item.path}/`)}
            tooltip={item.title}
            className="h-10 md:h-8"
          >
            <NavLink to={item.path} onClick={() => isMobile && setOpenMobile(false)}>
              <item.icon />
              <span>{item.title}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <CarFront className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-heading font-semibold">AutoMate</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Car ownership assistant
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col">
        <SidebarContent>
          {PRIMARY_GROUPS.map((group) => (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{NAV_GROUP_LABELS[group]}</SidebarGroupLabel>
              <SidebarGroupContent>
                <NavItems modules={appModules.filter((item) => item.navGroup === group)} />
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <NavItems modules={appModules.filter((item) => item.navGroup === "account")} />
        </SidebarFooter>
      </nav>
      <SidebarRail />
    </Sidebar>
  );
}

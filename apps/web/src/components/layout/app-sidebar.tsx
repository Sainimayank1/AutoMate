import { Link, NavLink, useLocation } from "react-router";

import { type AppModule, appModules, NAV_GROUP_LABELS, type NavGroup } from "@/app/modules";
import { BrandMark } from "@/components/layout/brand-logo";
import { VehicleSelector } from "@/components/layout/vehicle-selector";
import {
  Sidebar,
  SidebarContent,
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

const NAV_GROUPS = Object.keys(NAV_GROUP_LABELS) as NavGroup[];

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
            // Stitch: the active item gets the raised fill plus primary-coloured text and icon.
            className="h-10 data-active:[&_svg]:text-sidebar-primary md:h-8"
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
            <SidebarMenuButton size="lg" asChild tooltip="AutoMate">
              <Link to="/dashboard">
                {/* size-8! beats the menu button's [&_svg]:size-4; the mark is its own tile. */}
                <BrandMark className="size-8!" />
                <span className="font-heading text-lg font-medium">AutoMate</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <VehicleSelector />
      </SidebarHeader>

      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col">
        <SidebarContent>
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{NAV_GROUP_LABELS[group]}</SidebarGroupLabel>
              <SidebarGroupContent>
                <NavItems modules={appModules.filter((item) => item.navGroup === group)} />
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </nav>
      <SidebarRail />
    </Sidebar>
  );
}

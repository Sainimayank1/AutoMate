import { Check, ChevronDown, ChevronsUpDown, Plus, Warehouse } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { PlateBadge } from "@/components/common/plate-badge";
import { VehicleImage } from "@/components/common/vehicle-image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import { vehicleName } from "@/features/garage/constants";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatRegistration } from "@/utils/format";

/** Sidebar switcher for the active vehicle (Stitch dashboard). Archived vehicles never appear. */
export function VehicleSelector() {
  const { activeVehicle, isPending, isError } = useActiveVehicle();
  const { isMobile, setOpenMobile } = useSidebar();
  const closeOnMobile = () => isMobile && setOpenMobile(false);

  if (isPending) return <SidebarMenuSkeleton showIcon />;
  if (isError) return null; // the page itself reports the failure; the switcher just steps aside

  if (!activeVehicle) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="lg" tooltip="Add your first vehicle" className="border">
            <Link to="/garage/new" onClick={closeOnMobile}>
              <span className="flex size-8 items-center justify-center rounded-md bg-elevated">
                <Plus />
              </span>
              <span className="font-medium">Add your first vehicle</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={vehicleName(activeVehicle)}
              aria-label={`Active vehicle: ${vehicleName(activeVehicle)}. Switch vehicle`}
              className="border bg-elevated data-[state=open]:bg-sidebar-accent"
            >
              <VehicleImage
                variant="thumb"
                make={activeVehicle.make}
                model={activeVehicle.model}
                className="size-8!"
              />
              <span className="grid min-w-0 flex-1 gap-0.5 text-left leading-tight">
                <span className="truncate font-medium">{vehicleName(activeVehicle)}</span>
                <PlateBadge value={activeVehicle.registrationNumber} className="w-fit" />
              </span>
              <ChevronsUpDown className="ml-auto text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side={isMobile ? "bottom" : "right"}
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64"
          >
            <VehicleMenuItems onDone={closeOnMobile} />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** The switcher's menu: every vehicle (the active one ticked), then add and manage. */
function VehicleMenuItems({ onDone }: { onDone?: () => void }) {
  const { vehicles, activeVehicle, setActiveVehicleId } = useActiveVehicle();
  return (
    <>
      <DropdownMenuLabel>Switch vehicle</DropdownMenuLabel>
      {vehicles.map((vehicle) => (
        <DropdownMenuItem
          key={vehicle.id}
          onSelect={() => {
            setActiveVehicleId(vehicle.id);
            onDone?.();
          }}
          className="gap-3"
        >
          <VehicleImage
            variant="thumb"
            make={vehicle.make}
            model={vehicle.model}
            className="size-8"
          />
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="truncate font-medium">{vehicleName(vehicle)}</span>
            <PlateBadge value={vehicle.registrationNumber} className="w-fit" />
          </span>
          {vehicle.id === activeVehicle?.id && <Check className="text-brand" aria-label="Active" />}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link to="/garage/new" onClick={onDone}>
          <Plus />
          Add vehicle
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to="/garage" onClick={onDone}>
          <Warehouse />
          Manage garage
        </Link>
      </DropdownMenuItem>
    </>
  );
}

/**
 * The phone header's switcher on top-level pages (application-navigation.md, mobile shell): the
 * active vehicle's thumb, model and a chevron; the same menu as the sidebar's.
 */
export function HeaderVehicleSelector({ fallback }: { fallback: ReactNode }) {
  const { activeVehicle } = useActiveVehicle();
  // No vehicle yet (or still loading): the page's own call to action does the rest.
  if (!activeVehicle) return fallback;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Active vehicle: ${vehicleName(activeVehicle)}. Switch vehicle`}
          className="flex min-h-10 min-w-0 items-center gap-2 rounded-md px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <VehicleImage
            variant="thumb"
            make={activeVehicle.make}
            model={activeVehicle.model}
            className="size-8 shrink-0"
          />
          <span className="grid min-w-0 leading-tight">
            <span className="truncate text-sm font-medium">{activeVehicle.model}</span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {formatRegistration(activeVehicle.registrationNumber)}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <VehicleMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

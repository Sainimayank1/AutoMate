import { Check, ChevronsUpDown, Plus, Warehouse } from "lucide-react";
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
  const { vehicles, activeVehicle, setActiveVehicleId, isPending, isError } = useActiveVehicle();
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
                <span className="flex items-center gap-1.5 truncate font-medium">
                  <span className="size-2 shrink-0 rounded-full bg-success" aria-hidden />
                  <span className="truncate">{vehicleName(activeVehicle)}</span>
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {formatRegistration(activeVehicle.registrationNumber)}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side={isMobile ? "bottom" : "right"}
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64"
          >
            <DropdownMenuLabel>Switch vehicle</DropdownMenuLabel>
            {vehicles.map((vehicle) => (
              <DropdownMenuItem
                key={vehicle.id}
                onSelect={() => {
                  setActiveVehicleId(vehicle.id);
                  closeOnMobile();
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
                {vehicle.id === activeVehicle.id && (
                  <Check className="text-primary" aria-label="Active" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/garage/new" onClick={closeOnMobile}>
                <Plus />
                Add vehicle
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/garage" onClick={closeOnMobile}>
                <Warehouse />
                Manage garage
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

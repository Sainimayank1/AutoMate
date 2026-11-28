import { Plus } from "lucide-react";
import { Link } from "react-router";

import { shortcuts } from "@/components/layout/quick-add-shortcuts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { vehicleName } from "@/features/garage/constants";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/**
 * Phones: the bottom nav's "Add" opens this sheet (Stitch "Quick Add Sheet — Mobile"): six large
 * tiles for the active vehicle. Deviation: shadcn's bottom `Sheet` instead of a vaul `Drawer`
 * (same layout, no new dependency; no drag to dismiss).
 */
export function QuickAddSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { activeVehicle } = useActiveVehicle();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle>Add</SheetTitle>
          <SheetDescription>
            {activeVehicle
              ? `${vehicleName(activeVehicle)} · ${activeVehicle.registrationNumber}`
              : "Add a vehicle first to record against it"}
          </SheetDescription>
        </SheetHeader>
        <ul className="grid grid-cols-2 gap-3 px-4">
          {shortcuts(activeVehicle?.id).map(({ label, icon: Icon, href }) => (
            <li key={label}>
              <Link
                to={href}
                onClick={() => onOpenChange(false)}
                className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border bg-card p-3 text-sm font-medium outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-10 items-center justify-center rounded-md bg-muted text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <SheetFooter className="pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Desktop: the same list as the header's "+" menu. */
export function QuickAddMenu() {
  const { activeVehicle } = useActiveVehicle();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-8 md:inline-flex"
          aria-label="Add"
        >
          <Plus />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate text-xs text-muted-foreground">
          {activeVehicle ? `Add for ${vehicleName(activeVehicle)}` : "Add"}
        </DropdownMenuLabel>
        {shortcuts(activeVehicle?.id).map(({ label, icon: Icon, href }) => (
          <DropdownMenuItem key={label} asChild>
            <Link to={href}>
              <Icon />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { FuelType, type Vehicle } from "@automate/shared";
import {
  Archive,
  ArrowLeft,
  ArrowLeftRight,
  CarFront,
  EllipsisVertical,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageContainer } from "@/components/common/page-container";
import { PlateBadge } from "@/components/common/plate-badge";
import { VehicleImage } from "@/components/common/vehicle-image";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteVehicleDialog } from "@/features/garage/components/delete-vehicle-dialog";
import { DetailList } from "@/features/garage/components/detail-list";
import {
  PendingTransfer,
  TransferVehicleDialog,
} from "@/features/garage/components/vehicle-transfer";
import {
  CATEGORY_LABELS,
  FUEL_TYPE_LABELS,
  OWNERSHIP_LABELS,
  TRANSMISSION_LABELS,
  vehicleName,
} from "@/features/garage/constants";
import {
  useArchiveVehicle,
  useRestoreVehicle,
  useVehicle,
} from "@/features/garage/hooks/use-vehicles";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import {
  formatCurrency,
  formatDate,
  formatDistance,
  formatNumber,
  formatRegistration,
} from "@/utils/format";

/** Stitch "Vehicle Details" (desktop and mobile) and its "Specifications" tab. */
export function Component() {
  const { vehicleId = "" } = useParams();
  const { data: vehicle, isPending, isError, error, refetch } = useVehicle(vehicleId);

  if (isPending) return <VehicleSkeleton />;
  if (isError || !vehicle) {
    return (
      <PageContainer>
        {error?.status === 404 || error?.status === 400 ? (
          <EmptyState
            className="min-h-[50svh]"
            icon={CarFront}
            title="Vehicle not found"
            description="It may have been deleted, or it isn't in your garage."
            action={
              <Button asChild>
                <Link to="/garage">Back to garage</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState
            title="Couldn't load this vehicle"
            error={error}
            onRetry={() => void refetch()}
          />
        )}
      </PageContainer>
    );
  }
  return <VehicleDetails vehicle={vehicle} />;
}

function VehicleDetails({ vehicle }: { vehicle: Vehicle }) {
  const { activeVehicle, setActiveVehicleId } = useActiveVehicle();
  const archive = useArchiveVehicle();
  const restore = useRestoreVehicle();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const isArchived = vehicle.archivedAt !== null;
  const isActive = !isArchived && activeVehicle?.id === vehicle.id;
  const isElectric = vehicle.fuelType === FuelType.ELECTRIC;
  const name = vehicleName(vehicle);
  const editHref = `/garage/${vehicle.id}/edit`;
  const specsLine = [
    vehicle.variant,
    isElectric || !vehicle.engineCapacityCc
      ? FUEL_TYPE_LABELS[vehicle.fuelType]
      : `${formatNumber(vehicle.engineCapacityCc)} cc ${FUEL_TYPE_LABELS[vehicle.fuelType]}`,
    TRANSMISSION_LABELS[vehicle.transmission],
    vehicle.colour,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageContainer>
      <title>{`${name} · AutoMate`}</title>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" className="size-10 shrink-0 md:size-9" asChild>
            <Link to="/garage" aria-label="Back to garage">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-lg font-semibold tracking-tight">
              {name} {vehicle.variant}
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              {formatRegistration(vehicle.registrationNumber)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="max-md:hidden" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight data-icon="inline-start" />
            Transfer vehicle
          </Button>
          <Button variant="outline" asChild className="max-sm:hidden">
            <Link to={editHref}>
              <Pencil data-icon="inline-start" />
              Edit vehicle
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isArchived ? (
                <DropdownMenuItem onSelect={() => restore.mutate(vehicle.id)}>
                  <RotateCcw />
                  Restore vehicle
                </DropdownMenuItem>
              ) : (
                <>
                  {!isActive && (
                    <DropdownMenuItem onSelect={() => setActiveVehicleId(vehicle.id)}>
                      <CarFront />
                      Set as active vehicle
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => setTransferOpen(true)}>
                    <ArrowLeftRight />
                    Transfer to another account
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setArchiveOpen(true)}>
                    <Archive />
                    Archive vehicle
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2 />
                Delete vehicle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <PendingTransfer vehicle={vehicle} />
      <TransferVehicleDialog vehicle={vehicle} open={transferOpen} onOpenChange={setTransferOpen} />

      {isArchived && (
        <Alert>
          <Archive />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Archived on {formatDate(vehicle.archivedAt)}. It's hidden from the switcher; its
              records are kept.
            </span>
            <Button size="sm" variant="secondary" onClick={() => restore.mutate(vehicle.id)}>
              <RotateCcw data-icon="inline-start" />
              Restore
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="grid overflow-hidden rounded-xl border bg-card lg:grid-cols-12">
        <VehicleImage
          make={vehicle.make}
          model={vehicle.model}
          className="aspect-video lg:col-span-5 lg:aspect-auto lg:min-h-56"
        >
          {isActive && (
            <Badge className="absolute bottom-4 left-4">
              <span className="size-1.5 rounded-full bg-primary-foreground" aria-hidden />
              Active vehicle
            </Badge>
          )}
          <PlateBadge
            value={vehicle.registrationNumber}
            className="absolute top-4 right-4 lg:hidden"
          />
        </VehicleImage>

        <div className="flex flex-col justify-between gap-5 p-5 sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-semibold tracking-wider text-primary uppercase">
                Profile {vehicle.profileCompletion}% complete
              </span>
              <div
                className="h-1 w-40 overflow-hidden rounded-full bg-elevated lg:hidden"
                role="progressbar"
                aria-label="Profile completion"
                aria-valuenow={vehicle.profileCompletion}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full bg-primary"
                  style={{ width: `${vehicle.profileCompletion}%` }}
                />
              </div>
              <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                {name}
              </h2>
              <p className="text-sm text-muted-foreground">{specsLine}</p>
            </div>
            <div className="sm:text-right">
              <span className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Current odometer
              </span>
              <span className="font-mono text-2xl font-medium tabular-nums">
                {formatDistance(vehicle.odometerKm)}
              </span>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
            {[
              ["Purchase date", vehicle.purchaseDate ? formatDate(vehicle.purchaseDate) : "—"],
              ["Purchase price", vehicle.purchasePrice ? formatRupees(vehicle.purchasePrice) : "—"],
              ["Ownership", OWNERSHIP_LABELS[vehicle.ownershipType]],
              [
                "Registered on",
                vehicle.registrationDate ? formatDate(vehicle.registrationDate) : "—",
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-sm tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start border-b">
          {[
            ["overview", "Overview"],
            ["specifications", "Specifications"],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value!}
              className="flex-none px-3 data-active:text-primary after:bg-primary"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="grid gap-6 pt-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Registration & identity</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList
                addHref={editHref}
                items={[
                  {
                    label: "Registration no.",
                    value: formatRegistration(vehicle.registrationNumber),
                    mono: true,
                  },
                  {
                    label: "Registration date",
                    value: vehicle.registrationDate && formatDate(vehicle.registrationDate),
                    field: "registrationDate",
                  },
                  { label: "VIN / chassis", value: vehicle.vin, mono: true, field: "vin" },
                  {
                    label: "Engine number",
                    value: vehicle.engineNumber,
                    mono: true,
                    field: "engineNumber",
                  },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Technical summary</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList
                addHref={editHref}
                items={[
                  ...(isElectric
                    ? []
                    : [
                        {
                          label: "Engine",
                          value:
                            vehicle.engineCapacityCc &&
                            [
                              `${formatNumber(vehicle.engineCapacityCc)} cc`,
                              vehicle.engineConfiguration,
                            ]
                              .filter(Boolean)
                              .join(" · "),
                          field: "engineCapacityCc",
                        },
                        {
                          label: "Fuel tank",
                          value:
                            vehicle.fuelTankCapacityL &&
                            `${formatNumber(vehicle.fuelTankCapacityL)} L`,
                          field: "fuelTankCapacityL",
                        },
                      ]),
                  { label: "Transmission", value: TRANSMISSION_LABELS[vehicle.transmission] },
                  { label: "Tyre size", value: vehicle.tyreSize, mono: true, field: "tyreSize" },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="specifications" className="pt-4">
          <SpecificationsCard vehicle={vehicle} editHref={editHref} />
        </TabsContent>
      </Tabs>

      <Button size="lg" className="w-full sm:hidden" asChild>
        <Link to={editHref}>
          <Pencil data-icon="inline-start" />
          Edit vehicle
        </Link>
      </Button>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive ${name}?`}
        description="It will be hidden from the switcher and dashboard. Records are kept and you can restore it anytime."
        confirmLabel="Archive vehicle"
        onConfirm={() => archive.mutateAsync(vehicle.id).then(() => undefined)}
      />
      <DeleteVehicleDialog
        vehicle={vehicle}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onArchiveInstead={() => setArchiveOpen(true)}
      />
    </PageContainer>
  );
}

/** Whole rupees for headline figures (₹11,45,000); the full ₹11,45,000.00 is for records. */
const formatRupees = (value: string) => formatCurrency(value).replace(/\.00$/, "");

/** Stitch "Vehicle Details — Specifications": every field, grouped, with "Add" for missing ones. */
function SpecificationsCard({ vehicle, editHref }: { vehicle: Vehicle; editHref: string }) {
  const isElectric = vehicle.fuelType === FuelType.ELECTRIC;
  const groups = [
    {
      title: "Identity",
      items: [
        { label: "Make", value: vehicle.make },
        { label: "Model", value: vehicle.model },
        { label: "Variant", value: vehicle.variant, field: "variant" },
        { label: "Manufacturing year", value: String(vehicle.manufacturingYear) },
        { label: "Category", value: CATEGORY_LABELS[vehicle.category] },
        { label: "Colour", value: vehicle.colour, field: "colour" },
        {
          label: "Registration no.",
          value: formatRegistration(vehicle.registrationNumber),
          mono: true,
        },
        {
          label: "Registration date",
          value: vehicle.registrationDate && formatDate(vehicle.registrationDate),
          field: "registrationDate",
        },
        { label: "VIN / chassis", value: vehicle.vin, mono: true, field: "vin" },
        { label: "Engine number", value: vehicle.engineNumber, mono: true, field: "engineNumber" },
      ],
    },
    {
      title: "Engine & fuel",
      items: [
        { label: "Fuel type", value: FUEL_TYPE_LABELS[vehicle.fuelType] },
        { label: "Transmission", value: TRANSMISSION_LABELS[vehicle.transmission] },
        ...(isElectric
          ? []
          : [
              {
                label: "Displacement",
                value: vehicle.engineCapacityCc && `${formatNumber(vehicle.engineCapacityCc)} cc`,
                field: "engineCapacityCc",
              },
              {
                label: "Configuration",
                value: vehicle.engineConfiguration,
                field: "engineConfiguration",
              },
              {
                label: "Fuel tank",
                value: vehicle.fuelTankCapacityL && `${formatNumber(vehicle.fuelTankCapacityL)} L`,
                field: "fuelTankCapacityL",
              },
            ]),
        {
          label: "Fuel specification",
          value: vehicle.fuelSpecification,
          field: "fuelSpecification",
        },
        ...(isElectric
          ? []
          : [
              {
                label: "Engine oil",
                value: vehicle.engineOilSpecification,
                field: "engineOilSpecification",
              },
            ]),
      ],
    },
    {
      title: "Tyres & battery",
      items: [
        { label: "Tyre size", value: vehicle.tyreSize, mono: true, field: "tyreSize" },
        { label: "Battery", value: vehicle.batteryType, field: "batteryType" },
      ],
    },
    {
      title: "Ownership & warranty",
      items: [
        { label: "Ownership", value: OWNERSHIP_LABELS[vehicle.ownershipType] },
        {
          label: "Purchase date",
          value: vehicle.purchaseDate && formatDate(vehicle.purchaseDate),
          field: "purchaseDate",
        },
        {
          label: "Purchase price",
          value: vehicle.purchasePrice && formatRupees(vehicle.purchasePrice),
          field: "purchasePrice",
        },
        {
          label: "Warranty expires",
          value: vehicle.warrantyExpiryDate && formatDate(vehicle.warrantyExpiryDate),
          field: "warrantyExpiryDate",
        },
        {
          label: "Warranty limit",
          value: vehicle.warrantyKmLimit !== null ? formatDistance(vehicle.warrantyKmLimit) : null,
          field: "warrantyKmLimit",
        },
      ],
    },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col divide-y">
        {groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-3 py-5 first:pt-0">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {group.title}
            </h3>
            <DetailList items={group.items} addHref={editHref} />
          </section>
        ))}
        <section className="flex flex-col gap-3 pt-5">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Notes
          </h3>
          <DetailList
            items={[{ label: "Notes", value: vehicle.notes, field: "notes" }]}
            addHref={editHref}
            className="sm:grid-cols-1 [&_dd]:whitespace-pre-line [&_dt]:sr-only"
          />
        </section>
      </CardContent>
    </Card>
  );
}

function VehicleSkeleton() {
  return (
    <PageContainer aria-busy>
      <div className="flex items-center gap-3">
        <Skeleton className="size-9" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </PageContainer>
  );
}

import { istToday, type Vehicle } from "@automate/shared";
import {
  ArrowRight,
  Braces,
  Car,
  FileText,
  Fuel,
  type LucideIcon,
  ReceiptText,
  Route,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RestoreCard } from "@/features/backup/components/restore-card";
import { useDownload } from "@/features/backup/hooks/use-backup";
import { backupService } from "@/features/backup/services/backup-service";
import { buildArchive } from "@/features/backup/utils/archive";
import { fillsToCsv, serviceRecordsToCsv, vehicleToCsv } from "@/features/backup/utils/exports";
import { expenseService } from "@/features/expenses/services/expense-service";
import { expensesToCsv } from "@/features/expenses/utils/csv";
import { vehicleName } from "@/features/garage/constants";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { downloadCsv, downloadFile } from "@/utils/csv";

const today = () => istToday(new Date());
const downloadJson = (filename: string, data: unknown) =>
  downloadFile(filename, [JSON.stringify(data, null, 2)], "application/json");

/**
 * `/backup` (Stitch "Backup & Export"): per-vehicle exports, the full backup, restore and links
 * to data management. Exports are built in the browser from the API's lists, like the expenses
 * CSV. Deviations: no "Last downloaded" line (nothing records it); trips export from Trips.
 */
export function Component() {
  const { activeVehicle, vehicles, isPending, isError, error, refetch, setActiveVehicleId } =
    useActiveVehicle();
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        title="Backup & Export"
        description="Export your records, back everything up and restore a backup"
        actions={
          vehicles.length > 0 && (
            <Select value={activeVehicle?.id} onValueChange={setActiveVehicleId}>
              <SelectTrigger
                aria-label="Vehicle"
                className="w-full min-w-72 data-[size=default]:h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicleName(vehicle)} · {vehicle.registrationNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />
      {isError && !vehicles.length ? (
        <ErrorState
          title="Couldn't load your vehicles"
          error={error}
          onRetry={() => void refetch()}
        />
      ) : isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : activeVehicle ? (
        <ExportCard vehicle={activeVehicle} />
      ) : (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            Add a vehicle to export its records. You can still restore a backup below.
          </CardContent>
        </Card>
      )}
      <FullBackupCard />
      <RestoreCard />
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Data management
          </CardTitle>
          <CardDescription>
            To move a vehicle to another account, download its archive (ZIP) above, restore it from
            Backup &amp; Export in the other account, then archive or delete it here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium">
          <Link
            to={activeVehicle ? `/garage/${activeVehicle.id}` : "/garage"}
            className="inline-flex items-center gap-1.5 text-primary hover:underline max-md:min-h-10"
          >
            Archive or delete a vehicle (Garage) <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 text-destructive hover:underline max-md:min-h-10"
          >
            Delete your account (Settings) <ArrowRight className="size-4" aria-hidden />
          </Link>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function ExportCard({ vehicle }: { vehicle: Vehicle }) {
  const file = (what: string, extension: string) =>
    `automate-${vehicle.registrationNumber}-${what}-${today()}.${extension}`;
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="border-b pb-4">
        <CardTitle role="heading" aria-level={2}>
          Export
        </CardTitle>
      </CardHeader>
      <ul className="flex flex-col divide-y">
        <ExportRow
          icon={Fuel}
          title="Fuel history (CSV)"
          detail="Every fill-up with odometer, litres, price and station"
          run={async () =>
            downloadCsv(file("fuel", "csv"), fillsToCsv(await backupService.fills(vehicle.id)))
          }
        />
        <ExportRow
          icon={ReceiptText}
          title="Expenses (CSV)"
          detail="Manual and linked expenses, refunds as negative amounts"
          run={async () =>
            downloadCsv(
              file("expenses", "csv"),
              expensesToCsv(await expenseService.listAll({ vehicleId: vehicle.id }), () =>
                vehicleName(vehicle),
              ),
            )
          }
        />
        <ExportRow
          icon={Wrench}
          title="Service history (CSV)"
          detail="Service records with workshop, cost breakdown and items"
          run={async () =>
            downloadCsv(
              file("services", "csv"),
              serviceRecordsToCsv(await backupService.serviceRecords(vehicle.id)),
            )
          }
        />
        <LinkRow
          icon={Route}
          title="Trip history (CSV)"
          detail="From Trips, with its own import"
          to="/trips/history"
          label="Open Trips"
        />
        <ExportRow
          icon={Car}
          title="Vehicle details (CSV)"
          detail="Registration, specifications and ownership"
          run={() => Promise.resolve(downloadCsv(file("details", "csv"), vehicleToCsv(vehicle)))}
        />
        <LinkRow
          icon={FileText}
          title="Ownership report (PDF)"
          detail="Printable cost-of-ownership report: save it as a PDF from the print dialog"
          to={`/expenses/report?vehicle=${vehicle.id}&period=all_time`}
          label="Open report"
        />
        <ExportRow
          icon={Braces}
          title="Vehicle archive (ZIP)"
          detail="This vehicle with everything recorded for it and its files, ready to restore or to move to another account"
          label="Download"
          run={async () =>
            downloadFile(
              `automate-${vehicle.registrationNumber}-${today()}.zip`,
              [await buildArchive(vehicle.id)],
              "application/zip",
            )
          }
        />
      </ul>
    </Card>
  );
}

function Row({
  icon: Icon,
  title,
  detail,
  children,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-elevated text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      {children}
    </li>
  );
}

function ExportRow({
  label = "Download CSV",
  run,
  ...row
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  label?: string;
  run: () => Promise<void>;
}) {
  const job = useDownload(run);
  return (
    <Row {...row}>
      <Button
        variant="outline"
        className="max-sm:w-full"
        disabled={job.isPending}
        onClick={() => job.mutate()}
        aria-label={`${label}: ${row.title}`}
      >
        {job.isPending ? "Preparing…" : label}
      </Button>
    </Row>
  );
}

function LinkRow({
  to,
  label,
  ...row
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  to: string;
  label: string;
}) {
  return (
    <Row {...row}>
      <Button asChild variant="outline" className="max-sm:w-full">
        <Link to={to}>{label}</Link>
      </Button>
    </Row>
  );
}

function FullBackupCard() {
  const zip = useDownload(async () =>
    downloadFile(`automate-backup-${today()}.zip`, [await buildArchive()], "application/zip"),
  );
  const json = useDownload(async () =>
    downloadJson(`automate-backup-${today()}.json`, await backupService.backup()),
  );
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-1">
          <h2 className="font-heading text-base font-medium">Full backup</h2>
          <p className="text-sm text-muted-foreground">
            Everything: vehicles, fill-ups, service records, expenses with receipts, loans and
            recurring payments, budgets, parts and schedules, trips, documents with their files and
            your photo. The ZIP holds the files; the JSON is the records alone.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={json.isPending} onClick={() => json.mutate()}>
            {json.isPending ? "Preparing…" : "Records only (.json)"}
          </Button>
          <Button disabled={zip.isPending} onClick={() => zip.mutate()}>
            {zip.isPending ? "Preparing…" : "Download backup (.zip)"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

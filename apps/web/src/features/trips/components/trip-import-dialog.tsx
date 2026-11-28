import {
  guessTripColumns,
  type ImportRowStatus,
  parseCsv,
  TRIP_IMPORT_FIELDS,
  type TripImportField,
  type TripImportPreview,
  type TripImportResult,
  type Vehicle,
} from "@automate/shared";
import { CircleAlert, CircleCheck, Copy, SkipForward } from "lucide-react";
import { useId, useState } from "react";

import { FormError } from "@/components/common/form-error";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { vehicleName } from "@/features/garage/constants";
import { useImportTrips, usePreviewTripImport } from "@/features/trips/hooks/use-trips";
import { normalizeApiError } from "@/lib/api-error";
import { formatDate, formatDistance } from "@/utils/format";

const STATUS: Record<ImportRowStatus, { label: string; tone: StatusTone; icon: typeof Copy }> = {
  ready: { label: "Ready", tone: "success", icon: CircleCheck },
  duplicate: { label: "Duplicate", tone: "warning", icon: Copy },
  skipped: { label: "Skipped", tone: "neutral", icon: SkipForward },
  error: { label: "Error", tone: "destructive", icon: CircleAlert },
};
const FIELD_LABELS: Record<TripImportField, string> = {
  date: "Date",
  endDate: "End date",
  startTime: "Start time",
  endTime: "End time",
  type: "Type",
  title: "Title",
  origin: "From",
  destination: "To",
  startKm: "Start odometer",
  endKm: "End odometer",
  distanceKm: "Distance",
  notes: "Notes",
};
const NONE = "__none";
type Columns = Partial<Record<TripImportField, string>>;
type File = { name: string; csv: string; headers: string[]; rows: number };

/**
 * Stitch "Import Trips Dialog — Desktop": any CSV, its columns matched to trip fields (guessed
 * from the headers, changeable), checked by the API row by row before anything is saved; the
 * ready rows (and duplicates, when asked) are imported in one go.
 */
export function TripImportDialog({
  open,
  onOpenChange,
  vehicles,
  vehicleId: initialVehicle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  vehicleId: string | undefined;
}) {
  const id = useId();
  const [vehicleId, setVehicleId] = useState(initialVehicle ?? vehicles[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<Columns>({});
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [preview, setPreview] = useState<TripImportPreview | null>(null);
  const [result, setResult] = useState<TripImportResult | null>(null);
  const [error, setError] = useState<string>();
  const check = usePreviewTripImport();
  const commit = useImportTrips();
  const busy = check.isPending || commit.isPending;
  const values = (duplicates = includeDuplicates) => ({
    vehicleId,
    csv: file!.csv,
    columns,
    includeDuplicates: duplicates,
  });
  const failure = (cause: unknown) => {
    const apiError = normalizeApiError(cause);
    setError(Object.values(apiError.fieldErrors)[0] ?? apiError.message);
  };
  const runCheck = async (duplicates = includeDuplicates) => {
    setError(undefined);
    setResult(null);
    try {
      setPreview(await check.mutateAsync(values(duplicates)));
    } catch (cause) {
      setPreview(null);
      failure(cause);
    }
  };
  const importable = preview
    ? preview.counts.ready + (includeDuplicates ? preview.counts.duplicate : 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import trips</DialogTitle>
          <DialogDescription>
            Any CSV: match its columns to trip fields. Each row is checked like a trip you log
            yourself; nothing is saved until you import. Up to 500 rows.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-vehicle`}>Vehicle</Label>
              <Select
                value={vehicleId}
                onValueChange={(value) => {
                  setVehicleId(value);
                  setPreview(null);
                }}
              >
                <SelectTrigger id={`${id}-vehicle`} className="w-full data-[size=default]:h-10">
                  <SelectValue placeholder="Choose a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicleName(vehicle)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-file`}>CSV file</Label>
              <Input
                id={`${id}-file`}
                type="file"
                accept=".csv,text/csv"
                className="h-10"
                onChange={async (event) => {
                  const chosen = event.target.files?.[0];
                  setPreview(null);
                  setResult(null);
                  setError(undefined);
                  if (!chosen) return setFile(null);
                  const csv = await chosen.text();
                  const [headers = [], ...rows] = parseCsv(csv);
                  setFile({ name: chosen.name, csv, headers, rows: rows.length });
                  setColumns(guessTripColumns(headers));
                }}
              />
            </div>
          </div>

          {file && (
            <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">
                Match columns · {file.name} · {file.rows} rows
              </legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {TRIP_IMPORT_FIELDS.map((field) => (
                  <div key={field} className="flex flex-col gap-1">
                    <Label htmlFor={`${id}-${field}`} className="text-xs">
                      {FIELD_LABELS[field]}
                      {field === "date" && (
                        <span className="text-muted-foreground"> (required)</span>
                      )}
                    </Label>
                    <Select
                      value={columns[field] ?? NONE}
                      onValueChange={(header) => {
                        setPreview(null);
                        setColumns((current) => {
                          const next = { ...current };
                          if (header === NONE) delete next[field];
                          else next[field] = header;
                          return next;
                        });
                      }}
                    >
                      <SelectTrigger id={`${id}-${field}`} size="sm" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not in the file</SelectItem>
                        {file.headers
                          .filter((header) => header.trim())
                          .map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Rows need a date and either a distance or both odometer readings. An empty type
                imports as Other.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                disabled={busy || !vehicleId}
                onClick={() => void runCheck()}
              >
                {check.isPending && <Spinner data-icon="inline-start" />}
                Check file
              </Button>
            </fieldset>
          )}

          <FormError message={error} />
          {result && (
            <p className="text-sm" role="status">
              {result.imported} imported, {result.notImported} not imported
              {result.failed.length > 0 &&
                ` (lines ${result.failed.map((row) => row.line).join(", ")} were refused when saved)`}
              .
            </p>
          )}
          {preview && (
            <>
              <dl className="grid grid-cols-3 gap-2" aria-label="Rows by status">
                {(
                  [
                    ["ready", "Ready"],
                    ["duplicate", "Duplicates"],
                    ["error", "Errors"],
                  ] as const
                ).map(([status, label]) => (
                  <div key={status} className="flex flex-col gap-0.5 rounded-lg border p-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="font-heading text-lg font-semibold tabular-nums">
                      {preview.counts[status]}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Line</TableHead>
                      <TableHead className="max-sm:hidden">Date</TableHead>
                      <TableHead>Trip</TableHead>
                      <TableHead className="text-right max-sm:hidden">Distance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => {
                      const status = STATUS[row.status];
                      return (
                        <TableRow key={row.line}>
                          <TableCell className="align-top text-muted-foreground tabular-nums">
                            {row.line}
                          </TableCell>
                          <TableCell className="align-top tabular-nums max-sm:hidden">
                            {row.date ? formatDate(row.date) : "—"}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal">
                            <span className="font-medium">{row.label}</span>
                            {row.message && (
                              <span className="block text-xs text-muted-foreground">
                                {row.message}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right align-top tabular-nums max-sm:hidden">
                            {row.distanceKm ? formatDistance(row.distanceKm) : "—"}
                          </TableCell>
                          <TableCell className="align-top">
                            <StatusBadge
                              tone={status.tone}
                              icon={status.icon}
                              label={status.label}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {preview.counts.duplicate > 0 && (
                <Label className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={includeDuplicates}
                    onCheckedChange={(checked) => {
                      setIncludeDuplicates(checked === true);
                      // Duplicates join the odometer checks too.
                      void runCheck(checked === true);
                    }}
                  />
                  Also import the {preview.counts.duplicate} that look like duplicates
                </Label>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {result ? "Close" : "Cancel"}
          </Button>
          <Button
            type="button"
            disabled={busy || importable === 0}
            onClick={async () => {
              try {
                const done = await commit.mutateAsync(values());
                setPreview(null);
                setResult(done);
                if (!done.failed.length) onOpenChange(false);
              } catch (cause) {
                failure(cause);
              }
            }}
          >
            {commit.isPending && <Spinner data-icon="inline-start" />}
            {importable ? `Import ${importable} trip${importable === 1 ? "" : "s"}` : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import type { ExpenseImportPreview, ImportRowStatus, Vehicle } from "@automate/shared";
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
import { useImportExpenses, usePreviewImport } from "@/features/expenses/hooks/use-expenses";
import { vehicleName } from "@/features/garage/constants";
import { normalizeApiError } from "@/lib/api-error";
import { formatCurrency } from "@/utils/format";

const STATUS: Record<ImportRowStatus, { label: string; tone: StatusTone; icon: typeof Copy }> = {
  ready: { label: "Ready", tone: "success", icon: CircleCheck },
  duplicate: { label: "Duplicate", tone: "warning", icon: Copy },
  skipped: { label: "Skipped", tone: "neutral", icon: SkipForward },
  error: { label: "Error", tone: "destructive", icon: CircleAlert },
};
const COUNTS: { status: ImportRowStatus; label: string }[] = [
  { status: "ready", label: "Ready" },
  { status: "duplicate", label: "Duplicates" },
  { status: "skipped", label: "Skipped" },
  { status: "error", label: "Errors" },
];

/**
 * Stitch "Import Expenses Dialog": a CSV in the export's columns, checked by the API row by row
 * before anything is saved; the ready rows (and duplicates, when asked) are imported in one go.
 */
export function ImportDialog({
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
  const fileId = useId();
  const [vehicleId, setVehicleId] = useState(initialVehicle ?? vehicles[0]?.id ?? "");
  const [file, setFile] = useState<{ name: string; csv: string } | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [preview, setPreview] = useState<ExpenseImportPreview | null>(null);
  const [error, setError] = useState<string>();
  const check = usePreviewImport();
  const commit = useImportExpenses();
  const busy = check.isPending || commit.isPending;

  const run = async (next: { vehicleId: string; file: { name: string; csv: string } | null }) => {
    setPreview(null);
    setError(undefined);
    if (!next.vehicleId || !next.file) return;
    try {
      setPreview(
        await check.mutateAsync({
          vehicleId: next.vehicleId,
          csv: next.file.csv,
          includeDuplicates,
        }),
      );
    } catch (failure) {
      const apiError = normalizeApiError(failure);
      setError(Object.values(apiError.fieldErrors)[0] ?? apiError.message);
    }
  };
  const importable = preview
    ? preview.counts.ready + (includeDuplicates ? preview.counts.duplicate : 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import expenses</DialogTitle>
          <DialogDescription>
            A CSV with the columns the export writes: Date, Title, Category, Amount (INR), and
            optionally Subcategory, Payment method, Vendor and Notes. Up to 500 rows.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${fileId}-vehicle`}>Vehicle</Label>
              <Select
                value={vehicleId}
                onValueChange={(value) => {
                  setVehicleId(value);
                  void run({ vehicleId: value, file });
                }}
              >
                <SelectTrigger id={`${fileId}-vehicle`} className="w-full data-[size=default]:h-10">
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
              <Label htmlFor={fileId}>CSV file</Label>
              <Input
                id={fileId}
                type="file"
                accept=".csv,text/csv"
                className="h-10"
                onChange={async (event) => {
                  const chosen = event.target.files?.[0];
                  const next = chosen ? { name: chosen.name, csv: await chosen.text() } : null;
                  setFile(next);
                  void run({ vehicleId, file: next });
                }}
              />
            </div>
          </div>
          <FormError message={error} />
          {check.isPending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Checking {file?.name}…
            </p>
          )}
          {preview && (
            <>
              <dl className="grid grid-cols-4 gap-2" aria-label="Rows by status">
                {COUNTS.map(({ status, label }) => (
                  <div
                    key={status}
                    className="flex flex-col gap-0.5 rounded-lg border bg-elevated p-3"
                  >
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="font-heading text-lg font-medium tabular-nums">
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
                      <TableHead>Title</TableHead>
                      <TableHead className="text-right max-sm:hidden">Amount</TableHead>
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
                          <TableCell className="align-top whitespace-normal">
                            <span className="font-medium">{row.title || "—"}</span>
                            {row.message && (
                              <span className="block text-xs text-muted-foreground">
                                {row.message}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right align-top tabular-nums max-sm:hidden">
                            {row.amount ? formatCurrency(row.amount) : "—"}
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
                    onCheckedChange={(checked) => setIncludeDuplicates(checked === true)}
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
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || importable === 0}
            onClick={async () => {
              try {
                await commit.mutateAsync({ vehicleId, csv: file!.csv, includeDuplicates });
                onOpenChange(false);
              } catch (failure) {
                setError(normalizeApiError(failure).message);
              }
            }}
          >
            {commit.isPending && <Spinner data-icon="inline-start" />}
            {importable ? `Import ${importable} expense${importable === 1 ? "" : "s"}` : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

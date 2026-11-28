import {
  BACKUP_MAX_BYTES,
  type BackupCounts,
  type BackupIssue,
  type BackupRestoreReport,
  type BackupVehicleStatus,
} from "@automate/shared";
import {
  CircleAlert,
  CircleCheck,
  CircleSlash,
  CircleX,
  FileUp,
  type LucideIcon,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";

import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { usePreviewRestore, useRestore } from "@/features/backup/hooks/use-backup";
import { MAX_ARCHIVE_BYTES, readArchive, restoreFiles } from "@/features/backup/utils/archive";
import { normalizeApiError } from "@/lib/api-error";
import { formatDateTime, formatFileSize } from "@/utils/format";

const STATUS: Record<BackupVehicleStatus, { label: string; tone: StatusTone; icon: LucideIcon }> = {
  NEW: { label: "Will be restored", tone: "info", icon: RotateCcw },
  RESTORED: { label: "Restored", tone: "success", icon: CircleCheck },
  EXISTS: { label: "Already in your garage, skipped", tone: "neutral", icon: CircleSlash },
  INVALID: { label: "Can't be read", tone: "destructive", icon: CircleX },
  FAILED: { label: "Not restored", tone: "destructive", icon: CircleX },
};
const NOUNS: Record<keyof BackupCounts, [string, string]> = {
  fuel: ["fill-up", "fill-ups"],
  services: ["service record", "service records"],
  expenses: ["expense", "expenses"],
  trips: ["trip", "trips"],
  documents: ["document", "documents"],
  components: ["part", "parts"],
  inspections: ["inspection", "inspections"],
  schedules: ["schedule", "schedules"],
  loans: ["loan", "loans"],
  recurring: ["recurring payment", "recurring payments"],
  budgets: ["budget", "budgets"],
};
const ROW_LABEL: Record<BackupIssue["section"], string> = {
  vehicle: "Vehicle",
  fuel: "Fill-up",
  services: "Service record",
  expenses: "Expense",
  trips: "Trip",
  documents: "Document",
  components: "Part",
  inspections: "Inspection",
  schedules: "Schedule",
  loans: "Loan",
  recurring: "Recurring payment",
  budgets: "Budget",
};
const plural = (count: number, [one, many]: [string, string]) =>
  `${count} ${count === 1 ? one : many}`;
const countsText = (counts: BackupCounts) =>
  (Object.keys(NOUNS) as (keyof BackupCounts)[])
    .filter((key) => counts[key] > 0)
    .map((key) => plural(counts[key], NOUNS[key]))
    .join(" · ") || "Nothing recorded";
const errorText = (error: unknown) => {
  const normalized = normalizeApiError(error);
  return Object.values(normalized.fieldErrors)[0] ?? normalized.message;
};

/**
 * Restore (Stitch "Backup & Export"): choose a backup file, see what it would bring back (nothing
 * saved yet), then confirm. Vehicles already in the garage are left out; rows that fail their
 * checks are listed.
 */
export function RestoreCard() {
  const preview = usePreviewRestore();
  const restore = useRestore();
  const [file, setFile] = useState<{
    name: string;
    data: unknown;
    /** A ZIP backup's files, by path. */
    files: Record<string, Uint8Array> | null;
  } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [filesState, setFilesState] = useState<
    | { phase: "uploading"; done: number; total: number }
    | { phase: "done"; restored: number; failed: string[] }
    | null
  >(null);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setReadError(null);
    setFilesState(null);
    preview.reset();
    restore.reset();
  };
  const choose = async (picked: File) => {
    reset();
    const zip = /\.zip$/i.test(picked.name) || picked.type.includes("zip");
    const limit = zip ? MAX_ARCHIVE_BYTES : BACKUP_MAX_BYTES;
    if (picked.size > limit) {
      setReadError(`Use a backup file of ${formatFileSize(limit)} or less.`);
      return;
    }
    let data: unknown;
    let files: Record<string, Uint8Array> | null = null;
    try {
      if (zip) {
        ({ backup: data, files } = readArchive(new Uint8Array(await picked.arrayBuffer())));
      } else {
        data = JSON.parse(await picked.text());
      }
    } catch (error) {
      setReadError(
        error instanceof Error && error.message.startsWith("This ZIP")
          ? error.message
          : "This file isn't an AutoMate backup.",
      );
      return;
    }
    setFile({ name: picked.name, data, files });
    preview.mutate(data);
  };
  /** Records first, then each file from the ZIP to the record it now belongs to. */
  const runRestore = () =>
    restore.mutate(file!.data, {
      onSuccess: async (result) => {
        if (!file?.files || !result.files.length) return;
        setFilesState({ phase: "uploading", done: 0, total: result.files.length });
        const outcome = await restoreFiles(result.files, file.files, (done, total) =>
          setFilesState({ phase: "uploading", done, total }),
        );
        setFilesState({ phase: "done", ...outcome });
      },
    });

  const report = restore.data ?? preview.data;
  const error =
    readError ??
    (preview.isError ? errorText(preview.error) : null) ??
    (restore.isError ? errorText(restore.error) : null);
  const restorable =
    preview.data?.vehicles.filter((vehicle) => vehicle.status === "NEW").length ?? 0;
  const papers = preview.data?.documents.count ?? 0;
  const restored = restore.data?.vehicles.filter((vehicle) => vehicle.status === "RESTORED") ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Restore a backup
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!report && !preview.isPending && (
          <div
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-dashed bg-elevated px-5 py-6"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const dropped = event.dataTransfer.files[0];
              if (dropped) void choose(dropped);
            }}
          >
            <div className="flex items-center gap-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                <FileUp className="size-5" aria-hidden />
              </span>
              <p className="text-sm text-muted-foreground">
                Choose an AutoMate backup: the ZIP with files, or the JSON file (up to{" "}
                {formatFileSize(BACKUP_MAX_BYTES)})
              </p>
            </div>
            <Button variant="outline" onClick={() => input.current?.click()}>
              Choose file
            </Button>
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          aria-label="Backup file"
          className="sr-only"
          onChange={(event) => {
            const picked = event.target.files?.[0];
            if (picked) void choose(picked);
            event.target.value = "";
          }}
        />
        {error && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {preview.isPending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Checking the file…
          </p>
        )}
        {report && (
          <section
            aria-label={restore.data ? "Restored" : "In this backup"}
            className="flex flex-col overflow-hidden rounded-lg border bg-elevated"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <span className="text-sm font-medium tabular-nums">
                Backup from {formatDateTime(report.exportedAt)}
              </span>
              {file && <span className="font-mono text-xs text-muted-foreground">{file.name}</span>}
            </div>
            <Report report={report} done={!!restore.data} />
            {restore.isPending && (
              <p
                className="flex items-center gap-2.5 border-t px-4 py-3 text-sm font-medium"
                role="status"
              >
                <Spinner className="text-primary" /> Restoring… don&apos;t close this page
              </p>
            )}
            {preview.data && !restore.data && preview.data.fileCount > 0 && (
              <p className="border-t px-4 py-3 text-sm text-muted-foreground">
                {file?.files
                  ? `${plural(preview.data.fileCount, ["file", "files"])} (photos, receipts, document scans) will be restored too.`
                  : `This backup refers to ${plural(preview.data.fileCount, ["file", "files"])}; restore the ZIP backup to bring them back.`}
              </p>
            )}
            {filesState?.phase === "uploading" && (
              <p
                className="flex items-center gap-2.5 border-t px-4 py-3 text-sm font-medium"
                role="status"
              >
                <Spinner className="text-primary" /> Restoring files… {filesState.done} of{" "}
                {filesState.total}
              </p>
            )}
            {filesState?.phase === "done" && (
              <p className="border-t px-4 py-3 text-sm">
                {plural(filesState.restored, ["file", "files"])} restored
                {filesState.failed.length > 0 &&
                  `; couldn't restore ${filesState.failed.join(", ")}`}
                .
              </p>
            )}
            {restore.data && (
              <p className="flex flex-wrap items-center gap-2 border-t bg-success/10 px-4 py-3 text-sm">
                <CircleCheck className="size-4 text-success" aria-hidden />
                {restored.length
                  ? `Restored ${plural(restored.length, ["vehicle", "vehicles"])}.`
                  : "Nothing was restored."}
                {restored.map((vehicle) => (
                  <Link
                    key={vehicle.index}
                    to={`/garage/${vehicle.vehicleId}`}
                    className="font-medium text-primary underline"
                  >
                    {vehicle.name} ({vehicle.registrationNumber})
                  </Link>
                ))}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3 border-t px-4 py-3">
              {preview.data && !restore.data && !restorable && !papers && (
                <p className="mr-auto text-sm text-muted-foreground">
                  Nothing new to restore: every vehicle in it is already in your garage.
                </p>
              )}
              <Button
                variant="outline"
                onClick={reset}
                disabled={restore.isPending || filesState?.phase === "uploading"}
              >
                {restore.data ? "Restore another file" : "Cancel"}
              </Button>
              {!restore.data && (
                <Button
                  disabled={restore.isPending || (!restorable && !papers)}
                  onClick={runRestore}
                >
                  {restore.isPending
                    ? "Restoring…"
                    : restorable
                      ? `Restore ${plural(restorable, ["vehicle", "vehicles"])}`
                      : "Restore documents"}
                </Button>
              )}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function Report({ report, done }: { report: BackupRestoreReport; done: boolean }) {
  const paperIssues = report.documents.issues;
  return (
    <ul className="flex flex-col divide-y">
      {report.vehicles.map((vehicle) => {
        const status = STATUS[vehicle.status];
        const muted = vehicle.status === "EXISTS";
        return (
          <li key={vehicle.index} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className={muted ? "text-sm text-muted-foreground" : "text-sm font-medium"}>
                  {vehicle.name}
                </span>
                {vehicle.registrationNumber && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {vehicle.registrationNumber}
                  </span>
                )}
              </div>
              <StatusBadge tone={status.tone} icon={status.icon} label={status.label} />
            </div>
            {(vehicle.status === "NEW" || vehicle.status === "RESTORED") && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {countsText(vehicle.counts)}
              </p>
            )}
            <Issues issues={vehicle.issues} count={vehicle.issueCount} done={done} />
          </li>
        );
      })}
      {(report.documents.count > 0 || paperIssues.length > 0) && (
        <li className="flex flex-col gap-2 px-4 py-3">
          <p className="text-sm">
            Papers that aren&apos;t a vehicle&apos;s:{" "}
            <span className="tabular-nums">{plural(report.documents.count, NOUNS.documents)}</span>
          </p>
          <Issues issues={paperIssues} count={paperIssues.length} done={done} />
        </li>
      )}
      {!report.vehicles.length && !report.documents.count && (
        <li className="px-4 py-3 text-sm text-muted-foreground">This backup is empty.</li>
      )}
    </ul>
  );
}

function Issues({ issues, count, done }: { issues: BackupIssue[]; count: number; done: boolean }) {
  if (!count) return null;
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="issues" className="border-none">
        <AccordionTrigger className="py-1 text-xs text-warning">
          <span className="flex items-center gap-2">
            <TriangleAlert className="size-4" aria-hidden />
            {plural(count, ["row", "rows"])} {done ? "weren't" : "can't be"} restored
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {issues.map((issue) => (
              <li key={`${issue.section}-${issue.index}`}>
                {issue.section === "vehicle"
                  ? issue.message
                  : `${ROW_LABEL[issue.section]} ${issue.index + 1}: ${issue.message}`}
              </li>
            ))}
            {count > issues.length && <li>…and {count - issues.length} more</li>}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

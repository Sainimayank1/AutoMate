import { type DocumentFile, DocumentState } from "@automate/shared";
import { cn } from "cn";
import {
  Download,
  EllipsisVertical,
  ExternalLink,
  FileText,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageContainer } from "@/components/common/page-container";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { DOCUMENT_STATE, DOCUMENT_TYPES, stateLabel } from "@/features/documents/constants";
import {
  useDeleteDocument,
  useDocument,
  useFileLink,
  useOpenFile,
} from "@/features/documents/hooks/use-documents";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { formatDate, formatFileSize, formatRegistration } from "@/utils/format";

/**
 * `/documents/:documentId` (Stitch "Document Details"): the document with a preview of the chosen
 * file (photos inline, PDFs in the browser's viewer) through a short-lived link, its files, the
 * details, the reminders and a renewal.
 */
export function Component() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const document = useDocument(documentId);
  const vehicles = useVehicles();
  const remove = useDeleteDocument();
  const open = useOpenFile();
  const [chosen, setChosen] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const data = document.data;
  const file = data?.files.find((item) => item.id === chosen) ?? data?.files[0];

  if (document.isError && !data) {
    return (
      <PageContainer>
        <ErrorState
          title="Couldn't load the document"
          error={document.error}
          onRetry={() => void document.refetch()}
        />
      </PageContainer>
    );
  }
  if (!data) {
    return (
      <PageContainer>
        <Skeleton className="h-[480px] rounded-xl" />
      </PageContainer>
    );
  }
  const type = DOCUMENT_TYPES[data.type];
  const state = DOCUMENT_STATE[data.state];
  const Icon = type.icon;
  const vehicle = vehicles.data?.find((item) => item.id === data.vehicleId);
  const details = [
    { label: type.number, value: data.number, mono: true },
    { label: "Issued by", value: data.issuer },
    { label: "Issued", value: data.issueDate && formatDate(data.issueDate) },
    {
      label: data.state === DocumentState.EXPIRED ? "Expired on" : "Expires",
      value: data.expiryDate && formatDate(data.expiryDate),
      tone: state.date,
    },
    { label: "Notes", value: data.notes },
  ];

  return (
    <PageContainer>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              state.tile,
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">{data.name}</h1>
              <StatusBadge
                tone={state.tone}
                icon={state.icon}
                label={stateLabel(data.state, data.daysLeft)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {type.label}
              {vehicle &&
                ` · ${vehicleName(vehicle)} · ${formatRegistration(vehicle.registrationNumber)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild className="max-md:h-10">
            <Link to={`/documents/${data.id}/edit`}>
              <Pencil data-icon="inline-start" />
              Edit
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="max-md:size-10"
                aria-label="More actions"
              >
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <Card>
            <CardContent>
              {file ? (
                <Preview documentId={data.id} file={file} />
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
                  <FileText className="size-6 text-muted-foreground" aria-hidden />
                  <p className="text-sm text-muted-foreground">No copy attached yet.</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/documents/${data.id}/edit`}>Add a file</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          {data.files.length > 0 && (
            <ul aria-label="Files" className="flex flex-col gap-2">
              {data.files.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border bg-card px-3 py-2",
                    item.id === file?.id && "border-primary",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setChosen(item.id)}
                    aria-pressed={item.id === file?.id}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-10"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{item.fileName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatFileSize(item.size)}
                      </span>
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="max-md:size-10"
                    aria-label={`Open ${item.fileName}`}
                    onClick={() => open.mutate({ documentId: data.id, fileId: item.id })}
                  >
                    <ExternalLink />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="max-md:size-10"
                    aria-label={`Download ${item.fileName}`}
                    onClick={() => open.mutate({ documentId: data.id, fileId: item.id })}
                  >
                    <Download />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>
                Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
                {details.map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd
                      className={cn(
                        "text-right break-words",
                        row.mono && "font-mono text-xs leading-5",
                        row.tone,
                      )}
                    >
                      {row.value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>
                Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p>
                {data.reminderDays.length
                  ? `${data.reminderDays.join(", ").replace(/, (\d+)$/, " and $1")} days before expiry`
                  : "No reminders before expiry"}
              </p>
              {data.remindOn && (
                <p className="text-muted-foreground">Also on {formatDate(data.remindOn)}</p>
              )}
              {data.expiryDate && (
                <div className="flex flex-col gap-1 border-t pt-3">
                  <Button asChild className="self-start max-md:h-10">
                    <Link to={`/documents/${data.id}/edit?renew=1`}>
                      <RefreshCw data-icon="inline-start" />
                      Renew
                    </Link>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Add the new certificate and its dates
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${data.name}?`}
        description="The document and its files are deleted for good."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(data.id);
          navigate("/documents", { replace: true });
        }}
      />
    </PageContainer>
  );
}

/** The chosen file through a short-lived link: a photo inline, a PDF in the browser's viewer. */
function Preview({ documentId, file }: { documentId: string; file: DocumentFile }) {
  const link = useFileLink(documentId, file.id);
  const url = link.data?.url;
  if (link.isError) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        The preview couldn&apos;t load.
      </p>
    );
  }
  if (!url) return <Skeleton className="h-[480px] w-full" />;
  return file.contentType === "application/pdf" ? (
    <iframe
      src={url}
      title={`Preview of ${file.fileName}`}
      className="h-[480px] w-full rounded-lg border bg-muted"
    />
  ) : file.contentType === "image/heic" ? (
    // Most browsers can't show HEIC: open it instead.
    <p className="py-16 text-center text-sm text-muted-foreground">
      HEIC photos open in a new tab or download.
    </p>
  ) : (
    <img
      src={url}
      alt={file.fileName}
      className="max-h-[480px] w-full rounded-lg border bg-muted object-contain"
    />
  );
}

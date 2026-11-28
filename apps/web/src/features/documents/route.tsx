import { DocumentState, DocumentType, type Vehicle, type VehicleDocument } from "@automate/shared";
import { cn } from "cn";
import { FileUp, FolderOpen } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Pager } from "@/components/common/pager";
import { SearchInput } from "@/components/common/search-input";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DOCUMENT_STATE, DOCUMENT_TYPES, stateLabel } from "@/features/documents/constants";
import { useDocuments, useDocumentSummary } from "@/features/documents/hooks/use-documents";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { formatDate, formatRegistration } from "@/utils/format";

const PAGE_SIZE = 12;

/**
 * `/documents` (Stitch "Documents Vault"): counts by state, filters by type and a search, the
 * documents soonest to expire first, and the renewals coming up. Deviation: the Stitch subtitle's
 * "Encrypted storage" claim is now "Private storage" (we don't encrypt beyond the bucket's own).
 */
export function Component() {
  const [params, setParams] = useSearchParams();
  const type = (Object.values(DocumentType) as string[]).includes(params.get("type") ?? "")
    ? (params.get("type") as DocumentType)
    : undefined;
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [page, setPage] = useState(1);
  const vehicles = useVehicles();
  const summary = useDocumentSummary(undefined);
  const list = useDocuments({ type, search: search || undefined, page, pageSize: PAGE_SIZE });
  const renewals = useDocuments({ state: DocumentState.EXPIRED, pageSize: 3 });
  const soon = useDocuments({ state: DocumentState.EXPIRING, pageSize: 3 });
  const byId = new Map((vehicles.data ?? []).map((vehicle) => [vehicle.id, vehicle]));
  const items = list.data?.items ?? [];
  const setType = (value: DocumentType | undefined) => {
    setPage(1);
    setParams(
      (current) => {
        if (value) current.set("type", value);
        else current.delete("type");
        return current;
      },
      { replace: true },
    );
  };
  const add = (
    <Button asChild>
      <Link to="/documents/new">
        <FileUp data-icon="inline-start" />
        Add document
      </Link>
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Documents"
        description="Private storage for RC, insurance, PUC, licence and warranty records"
        actions={add}
      />

      <section aria-label="Documents by state" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Total documents",
            value: summary.data?.total,
            note: `Across ${summary.data?.vehicles ?? 0} vehicle${summary.data?.vehicles === 1 ? "" : "s"}`,
            tone: "",
          },
          {
            label: "Valid",
            value: summary.data?.valid,
            note: "More than 30 days left",
            tone: "text-success",
          },
          {
            label: "Expiring soon",
            value: summary.data?.expiring,
            note: "Within 30 days",
            tone: "text-warning",
          },
          {
            label: "Expired",
            value: summary.data?.expired,
            note: "Renew these",
            tone: "text-destructive",
          },
        ].map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
            <span className="text-xs font-medium text-muted-foreground">{tile.label}</span>
            {summary.data ? (
              <span className={cn("font-heading text-2xl font-semibold tabular-nums", tile.tone)}>
                {tile.value}
              </span>
            ) : (
              <Skeleton className="h-8 w-12" />
            )}
            <span className={cn("text-xs text-muted-foreground", tile.tone)}>{tile.note}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="group"
          aria-label="Document type"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
        >
          <Button
            size="sm"
            variant="outline"
            aria-pressed={!type}
            className="shrink-0 aria-pressed:border-primary aria-pressed:text-primary max-md:h-10"
            onClick={() => setType(undefined)}
          >
            All{summary.data ? ` (${summary.data.total})` : ""}
          </Button>
          {Object.values(DocumentType).map((value) => (
            <Button
              key={value}
              size="sm"
              variant="outline"
              aria-pressed={type === value}
              className="shrink-0 aria-pressed:border-primary aria-pressed:text-primary max-md:h-10"
              onClick={() => setType(value)}
            >
              {DOCUMENT_TYPES[value].label}
            </Button>
          ))}
        </div>
        <SearchInput
          value={search}
          onValueChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search name, number, issuer"
          aria-label="Search documents"
          className="md:w-72"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section aria-label="Documents" className="flex flex-col gap-4 lg:col-span-8">
          {list.isError && !list.data ? (
            <ErrorState
              title="Couldn't load your documents"
              error={list.error}
              onRetry={() => void list.refetch()}
            />
          ) : list.isPending ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              className="rounded-xl border border-dashed"
              icon={FolderOpen}
              title={type || search ? "No documents match" : "No documents yet"}
              description={
                type || search
                  ? "Try another type or search."
                  : "Add your RC, insurance and PUC to keep their dates and copies in one place."
              }
              action={type || search ? undefined : add}
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {items.map((document) => (
                <li key={document.id}>
                  <DocumentCard document={document} vehicle={byId.get(document.vehicleId ?? "")} />
                </li>
              ))}
            </ul>
          )}
          {(list.data?.meta.totalPages ?? 0) > 1 && (
            <Pager page={page} pageCount={list.data!.meta.totalPages} onPageChange={setPage} />
          )}
        </section>

        <Card className="self-start lg:col-span-4">
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Renewals
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[...(renewals.data?.items ?? []), ...(soon.data?.items ?? [])].map((document) => (
              <Renewal
                key={document.id}
                document={document}
                vehicle={byId.get(document.vehicleId ?? "")}
              />
            ))}
            {renewals.data &&
              soon.data &&
              !renewals.data.items.length &&
              !soon.data.items.length && (
                <p className="text-sm text-muted-foreground">
                  Nothing to renew in the next 30 days.
                </p>
              )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function DocumentCard({ document, vehicle }: { document: VehicleDocument; vehicle?: Vehicle }) {
  const type = DOCUMENT_TYPES[document.type];
  const state = DOCUMENT_STATE[document.state];
  const Icon = type.icon;
  const expired = document.state === DocumentState.EXPIRED;
  return (
    <Link
      to={`/documents/${document.id}`}
      className={cn(
        "flex h-full flex-col justify-between gap-4 rounded-xl border bg-card p-5 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        state.card,
      )}
    >
      <div className="flex items-start justify-between gap-2">
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
            <h3 className="truncate font-medium">{document.name}</h3>
            <p className="truncate text-xs text-muted-foreground">
              {vehicle
                ? `${vehicleName(vehicle)} · ${formatRegistration(vehicle.registrationNumber)}`
                : (document.issuer ?? type.label)}
            </p>
          </div>
        </div>
        <StatusBadge
          tone={state.tone}
          icon={state.icon}
          label={stateLabel(document.state, document.daysLeft)}
        />
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{type.number}</dt>
          <dd className="truncate font-mono text-xs">{document.number ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {expired ? "Expired on" : "Expiry date"}
          </dt>
          <dd className={cn("tabular-nums", state.date)}>{formatDate(document.expiryDate)}</dd>
        </div>
      </dl>
    </Link>
  );
}

function Renewal({ document, vehicle }: { document: VehicleDocument; vehicle?: Vehicle }) {
  const expired = document.state === DocumentState.EXPIRED;
  const days = Math.abs(document.daysLeft ?? 0);
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-elevated p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">
          Renew {vehicle ? `${vehicle.model} ` : ""}
          {DOCUMENT_TYPES[document.type].label}
        </span>
        <span
          className={cn(
            "shrink-0 text-xs font-medium",
            expired ? "text-destructive" : "text-warning",
          )}
        >
          {expired ? "Overdue" : formatDate(document.expiryDate)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {expired
          ? `Expired ${days} day${days === 1 ? "" : "s"} ago`
          : `Reminders ${document.reminderDays.join(", ")} days before`}
      </p>
      <Link
        to={`/documents/${document.id}/edit?renew=1`}
        className="self-start text-sm font-medium text-primary hover:underline max-md:inline-flex max-md:min-h-10 max-md:items-center"
      >
        {expired ? "Upload new" : "Renew"}
      </Link>
    </div>
  );
}

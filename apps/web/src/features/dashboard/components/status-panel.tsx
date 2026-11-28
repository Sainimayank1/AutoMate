import type {
  ActionItem,
  DueState,
  ItemSource,
  UntrackedArea,
  VehicleStatus,
} from "@automate/shared";
import { cn } from "cn";
import { CircleAlert, Clock, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";

const TITLES: Record<VehicleStatus["level"], string> = {
  attention: "Attention required",
  incomplete: "Vehicle health information incomplete",
  // Only when everything is tracked; still not "healthy" (that would need an inspection).
  no_issues: "No issues recorded",
};

const STATE: Record<DueState, { label: string; tone: StatusTone; icon: typeof Clock }> = {
  overdue: { label: "Overdue", tone: "destructive", icon: CircleAlert },
  due_today: { label: "Due today", tone: "warning", icon: TriangleAlert },
  due_soon: { label: "Due soon", tone: "warning", icon: Clock },
  info: { label: "Info", tone: "neutral", icon: Info },
};

/** The most urgent first; the rest one tap away, so the panel stays beside the hero. */
const VISIBLE = 3;

const SOURCE: Record<ItemSource, string> = {
  maintenance: "Maintenance",
  insurance: "Insurance",
  warranty: "Warranty",
  payment: "Payment",
  document: "Document",
};

/** Row surface by state (Stitch: red for overdue, amber for due, neutral otherwise). */
const BOX: Record<DueState, string> = {
  overdue: "border-destructive/40 bg-destructive/10",
  due_today: "border-warning/40 bg-warning/10",
  due_soon: "border-warning/40 bg-warning/10",
  info: "bg-muted/40",
};

const untrackedText = (areas: UntrackedArea[]) =>
  areas.length > 1
    ? "Maintenance and documents aren't tracked yet"
    : areas[0] === "maintenance"
      ? "Maintenance isn't tracked yet"
      : "Documents aren't tracked yet";

/**
 * Stitch "Dashboard" vehicle status, which is also the action centre: why the status is what it
 * is, then everything up next across modules, most urgent first. Each row opens its record and
 * carries the one action that fits. While something is untracked it says so instead of calling
 * the car healthy.
 */
export function StatusPanel({ status }: { status: VehicleStatus }) {
  const [expanded, setExpanded] = useState(false);
  const hidden = status.items.length - VISIBLE;
  const shown = expanded ? status.items : status.items.slice(0, VISIBLE);
  return (
    <section
      aria-labelledby="vehicle-status-title"
      className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5"
    >
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Vehicle status
        </span>
        <h2 id="vehicle-status-title" className="font-heading text-base font-semibold">
          {TITLES[status.level]}
        </h2>
        {status.untracked.length > 0 && (
          <p className="text-sm text-pretty text-muted-foreground">
            {untrackedText(status.untracked)}, so AutoMate can&apos;t tell how the car is doing.
          </p>
        )}
      </div>
      {status.items.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Up next
          </h3>
          <ul id="up-next" className="flex flex-col gap-2">
            {shown.map((item) => (
              <li key={item.id}>
                <ActionRow item={item} />
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <Button
              variant="link"
              size="sm"
              className="h-auto self-start p-0 max-md:min-h-10"
              aria-expanded={expanded}
              aria-controls="up-next"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show fewer" : `Show ${hidden} more`}
            </Button>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Nothing due on the records AutoMate has.
        </p>
      )}
    </section>
  );
}

function ActionRow({ item }: { item: ActionItem }) {
  const state = STATE[item.state];
  const text = (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-sm font-medium">{item.title}</span>
      {item.detail && <span className="text-xs text-muted-foreground">{item.detail}</span>}
    </span>
  );
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-lg border p-3", BOX[item.state])}>
      {/* State, source and the action on one line; the title opens the record (never nested). */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <StatusBadge tone={state.tone} icon={state.icon} label={state.label} />
          <span className="truncate text-xs text-muted-foreground">{SOURCE[item.source]}</span>
        </span>
        {item.action && (
          <Button
            asChild
            size="xs"
            variant="outline"
            className="shrink-0 bg-card max-md:h-10 max-md:px-3"
          >
            <Link to={item.action.href}>{item.action.label}</Link>
          </Button>
        )}
      </div>
      {item.href ? (
        <Link
          to={item.href}
          className="rounded-md outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {text}
        </Link>
      ) : (
        text
      )}
    </div>
  );
}

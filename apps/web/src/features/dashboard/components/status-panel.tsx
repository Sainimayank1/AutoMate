import type { StatusItem, UntrackedArea, VehicleStatus } from "@automate/shared";
import { cn } from "cn";
import { ChevronRight, CircleAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { Link } from "react-router";

const TITLES: Record<VehicleStatus["level"], string> = {
  attention: "Attention required",
  incomplete: "Vehicle health information incomplete",
  // Only when everything is tracked; still not "healthy" (that would need an inspection).
  no_issues: "No issues recorded",
};

const SEVERITY = {
  critical: {
    icon: CircleAlert,
    label: "Urgent",
    box: "border-destructive/40 bg-destructive/10",
    text: "text-destructive",
  },
  warning: {
    icon: TriangleAlert,
    label: "Due soon",
    box: "border-warning/40 bg-warning/10",
    text: "text-warning",
  },
  info: { icon: ShieldCheck, label: "For information", box: "bg-muted/40", text: "" },
} as const;

const untrackedText = (areas: UntrackedArea[]) =>
  areas.length > 1
    ? "Maintenance and documents aren't tracked yet"
    : areas[0] === "maintenance"
      ? "Maintenance isn't tracked yet"
      : "Documents aren't tracked yet";

/**
 * Stitch "Dashboard" vehicle status: facts from records the user keeps, most urgent first, each
 * opening its record. While something is untracked it says so instead of calling the car healthy.
 */
export function StatusPanel({ status }: { status: VehicleStatus }) {
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
        <ul className="flex flex-col gap-2.5">
          {status.items.map((item) => (
            <li key={item.id}>
              <StatusRow item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No insurance or warranty dates on record for this vehicle.
        </p>
      )}
    </section>
  );
}

function StatusRow({ item }: { item: StatusItem }) {
  const severity = SEVERITY[item.severity];
  const Icon = severity.icon;
  const body = (
    <div className={cn("flex items-start gap-2.5 rounded-lg border p-3", severity.box)}>
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", severity.text || "text-muted-foreground")}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-sm font-medium", severity.text)}>
          <span className="sr-only">{severity.label}: </span>
          {item.title}
        </span>
        {item.detail && <span className="text-xs text-muted-foreground">{item.detail}</span>}
      </div>
      {item.href && (
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
  return item.href ? (
    <Link
      to={item.href}
      className="block rounded-lg outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

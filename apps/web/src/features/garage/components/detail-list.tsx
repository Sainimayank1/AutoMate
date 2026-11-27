import { cn } from "cn";
import type { ReactNode } from "react";
import { Link } from "react-router";

export type DetailItem = {
  label: string;
  value: ReactNode;
  /** Geist Mono for plates, VINs, engine numbers, tyre sizes. */
  mono?: boolean;
  /** The form field behind the value: "Add" opens the edit page focused on it. */
  field?: string;
};

type DetailListProps = {
  items: DetailItem[];
  /** The edit page. A missing value with a `field` gets "Add", linking to `addHref#field`. */
  addHref?: string;
  className?: string;
};

/** Two-column definition list (Stitch "Registration & identity"). Missing values read "Not added". */
export function DetailList({ items, addHref, className }: DetailListProps) {
  return (
    <dl className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>
      {items.map(({ label, value, mono, field }) => {
        const missing = value === null || value === undefined || value === "";
        return (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn("text-sm break-words", mono && !missing && "font-mono tabular-nums")}>
              {missing ? (
                <span className="text-muted-foreground/70">
                  Not added
                  {addHref && field && (
                    <>
                      {" · "}
                      <Link
                        to={`${addHref}#${field}`}
                        aria-label={`Add ${label.toLowerCase()}`}
                        className="font-medium text-primary hover:underline"
                      >
                        Add
                      </Link>
                    </>
                  )}
                </span>
              ) : (
                value
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

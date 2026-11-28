import type { ReactNode } from "react";

/** A numbered section card of a maintenance task page (Stitch "Add Schedule" pattern). */
export function FormSection({
  step,
  title,
  aside,
  children,
}: {
  step: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary tabular-nums">
            {step}
          </span>
          <h2 className="font-heading text-base font-medium">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

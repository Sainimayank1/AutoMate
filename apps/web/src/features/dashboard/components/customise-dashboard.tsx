import {
  type DashboardLayout,
  DashboardMetric,
  type DashboardWidget,
  DEFAULT_DASHBOARD_LAYOUT,
} from "@automate/shared";
import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { METRIC_LABELS, WIDGET_LABELS } from "@/features/dashboard/constants";
import { useSaveDashboardLayout } from "@/features/dashboard/hooks/use-dashboard-layout";
import { useIsMobile } from "@/hooks/use-mobile";

const METRICS = Object.values(DashboardMetric);
const same = (a: DashboardLayout, b: DashboardLayout) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Stitch "Dashboard — Customise": show, hide and reorder the sections and choose the key figures,
 * saved to the account. The vehicle and its status stay at the top. Reordering uses up/down buttons
 * (no drag-and-drop package in the app); each move is announced.
 */
export function CustomiseDashboard({
  layout,
  disabled = false,
}: {
  layout: DashboardLayout;
  /** Until the saved layout has loaded: saving the default over it would lose it. */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(layout);
  const [announcement, setAnnouncement] = useState("");
  const save = useSaveDashboardLayout();
  const id = useId();
  // Stitch: a side sheet on desktop, a bottom sheet on phones.
  const mobile = useIsMobile();

  const openChange = (next: boolean) => {
    if (next) {
      setDraft(layout);
      setAnnouncement("");
    }
    setOpen(next);
  };
  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= draft.widgets.length) return;
    const widgets = [...draft.widgets];
    [widgets[index], widgets[target]] = [widgets[target]!, widgets[index]!];
    setDraft({ ...draft, widgets });
    // React moves the row that went down, which drops focus from its button: put it back.
    const button = `${id}-${widgets[target]!.id}-${by < 0 ? "up" : "down"}`;
    requestAnimationFrame(() => document.getElementById(button)?.focus());
    setAnnouncement(
      `${WIDGET_LABELS[widgets[target]!.id]} moved to position ${target + 1} of ${widgets.length}`,
    );
  };
  const toggleWidget = (widget: DashboardWidget, visible: boolean) =>
    setDraft({
      ...draft,
      widgets: draft.widgets.map((item) => (item.id === widget ? { ...item, visible } : item)),
    });
  const toggleMetric = (metric: DashboardMetric, on: boolean) => {
    const chosen = on ? [...draft.metrics, metric] : draft.metrics.filter((m) => m !== metric);
    setDraft({ ...draft, metrics: METRICS.filter((m) => chosen.includes(m)) });
  };
  const submit = () => save.mutate(draft, { onSuccess: () => setOpen(false) });

  return (
    <Sheet open={open} onOpenChange={openChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="max-md:size-10 max-md:px-0" disabled={disabled}>
          <SlidersHorizontal data-icon="inline-start" className="max-md:m-0" />
          <span className="max-md:sr-only">Customise</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        className="gap-0 data-[side=bottom]:max-h-[85dvh] data-[side=bottom]:rounded-t-xl data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Customise dashboard</SheetTitle>
          <SheetDescription>
            Choose what shows and in what order. Saved to your account.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <section aria-labelledby={`${id}-sections`} className="flex flex-col gap-2">
            <h3 id={`${id}-sections`} className="text-xs font-medium text-muted-foreground">
              Sections
            </h3>
            <p className="text-xs text-muted-foreground">
              The vehicle and its status always stay at the top.
            </p>
            <ol className="flex flex-col divide-y rounded-lg border bg-elevated">
              {draft.widgets.map((widget, index) => {
                const label = WIDGET_LABELS[widget.id];
                const first = index === 0;
                const last = index === draft.widgets.length - 1;
                return (
                  <li key={widget.id} className="flex items-center gap-3 py-1.5 pr-1.5 pl-3">
                    <Switch
                      id={`${id}-${widget.id}`}
                      checked={widget.visible}
                      onCheckedChange={(visible) => toggleWidget(widget.id, visible)}
                    />
                    <Label
                      htmlFor={`${id}-${widget.id}`}
                      className={
                        widget.visible ? "flex-1" : "flex-1 font-normal text-muted-foreground"
                      }
                    >
                      {label}
                    </Label>
                    {/* aria-disabled, not disabled: the button keeps focus at either end. */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="aria-disabled:opacity-40 max-md:size-10"
                      id={`${id}-${widget.id}-up`}
                      aria-label={`Move ${label} up`}
                      aria-disabled={first}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="aria-disabled:opacity-40 max-md:size-10"
                      id={`${id}-${widget.id}-down`}
                      aria-label={`Move ${label} down`}
                      aria-disabled={last}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </li>
                );
              })}
            </ol>
            <p aria-live="polite" className="sr-only">
              {announcement}
            </p>
          </section>
          <section aria-labelledby={`${id}-metrics`} className="flex flex-col gap-2">
            <h3 id={`${id}-metrics`} className="text-xs font-medium text-muted-foreground">
              Key figures
            </h3>
            <p className="text-xs text-muted-foreground">Choose at least one.</p>
            <ul className="flex flex-col gap-1">
              {METRICS.map((metric) => {
                const checked = draft.metrics.includes(metric);
                return (
                  <li key={metric} className="flex min-h-10 items-center gap-3">
                    <Checkbox
                      id={`${id}-${metric}`}
                      checked={checked}
                      // The last one can't go: the strip needs a figure.
                      disabled={checked && draft.metrics.length === 1}
                      onCheckedChange={(on) => toggleMetric(metric, on === true)}
                    />
                    <Label htmlFor={`${id}-${metric}`} className="font-normal">
                      {METRIC_LABELS[metric]}
                    </Label>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
        <SheetFooter className="flex-row flex-wrap items-center border-t px-5 max-md:[&_button]:h-10">
          <Button
            variant="ghost"
            className="mr-auto aria-disabled:opacity-50"
            // aria-disabled: after a reset the button keeps focus.
            aria-disabled={same(draft, DEFAULT_DASHBOARD_LAYOUT)}
            onClick={() => setDraft(DEFAULT_DASHBOARD_LAYOUT)}
          >
            Reset to default
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={same(draft, layout) || save.isPending}>
            {save.isPending && <Spinner data-icon="inline-start" />}
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

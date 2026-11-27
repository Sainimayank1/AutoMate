import type {
  DashboardInsights,
  DateWindow,
  Insight,
  InsightConfidence,
  InsightNeed,
  InsightTone,
  InsightTopic,
} from "@automate/shared";
import { cn } from "cn";
import { ArrowRight, Fuel, Lightbulb, type LucideIcon, Receipt, Route, Wrench } from "lucide-react";
import { useId } from "react";
import { Link } from "react-router";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateRange } from "@/utils/format";

const TOPIC_ICON: Record<InsightTopic, LucideIcon> = {
  spending: Receipt,
  fuel: Fuel,
  usage: Route,
  maintenance: Wrench,
};

/** Amber for costs and worse running, green for improvements, muted for the rest. */
const TONE: Record<InsightTone, { tile: string; icon: string; label: string }> = {
  negative: { tile: "border-l-warning", icon: "bg-warning/10 text-warning", label: "Worth a look" },
  positive: { tile: "border-l-success", icon: "bg-success/10 text-success", label: "Improving" },
  neutral: {
    tile: "border-l-muted-foreground/60",
    icon: "bg-muted text-muted-foreground",
    label: "For context",
  },
};

const CONFIDENCE: Record<InsightConfidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const NEEDS: Record<InsightNeed, string> = {
  expenses: "expenses",
  fuel_cycles: "full-tank fill-ups",
  odometer: "odometer readings",
};

/** Columns for 1–4 tiles, so a short list still fills the row. */
const COLUMNS = [
  "",
  "",
  "sm:grid-cols-2",
  "sm:grid-cols-2 lg:grid-cols-3",
  "sm:grid-cols-2 xl:grid-cols-4",
];

const needsText = (needs: InsightNeed[]) => {
  const parts = needs.map((need) => NEEDS[need]);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
};

/**
 * Stitch "Dashboard" smart insights: what stands out in the vehicle's records, found by the API's
 * fixed rules (never AI, so no Sparkles). Each tile says why, against what, how sure, and where to
 * look. With too few records it says which records unlock more.
 */
export function SmartInsights({
  insights,
  comparedWith,
}: {
  insights: DashboardInsights;
  comparedWith: DateWindow;
}) {
  const { items, needs } = insights;
  const titleId = useId();
  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-insight/10 text-insight">
          <Lightbulb className="size-4" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <CardTitle id={titleId} role="heading" aria-level={2}>
            Smart insights
          </CardTitle>
          <CardDescription>From your own records · rules, not AI</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.length > 0 ? (
          <ul className={cn("grid gap-3", COLUMNS[items.length])}>
            {items.map((insight) => (
              <li key={insight.id} className="flex">
                <InsightTile insight={insight} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {needs.length
              ? "Insights compare this period with the one before."
              : `Nothing stands out against ${formatDateRange(comparedWith)}.`}
          </p>
        )}
        {needs.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {items.length ? "More insights" : "They appear"} once {needsText(needs)} cover both
            periods.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function InsightTile({ insight }: { insight: Insight }) {
  const tone = TONE[insight.tone];
  const Icon = TOPIC_ICON[insight.topic];
  const facts = [
    insight.comparedWith && `vs ${formatDateRange(insight.comparedWith)}`,
    insight.confidence && CONFIDENCE[insight.confidence],
  ].filter(Boolean);
  return (
    <div
      className={cn(
        "flex flex-1 flex-col justify-between gap-3 rounded-lg border border-l-2 bg-elevated p-4",
        tone.tile,
      )}
    >
      <div className="flex flex-col gap-2">
        <span className={cn("flex size-7 items-center justify-center rounded-md", tone.icon)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <h3 className="text-sm font-medium text-balance">
          <span className="sr-only">{tone.label}: </span>
          {insight.title}
        </h3>
        <p className="text-xs text-muted-foreground tabular-nums">{insight.explanation}</p>
      </div>
      <div className="flex flex-col gap-2 pt-1">
        {facts.length > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">{facts.join(" · ")}</p>
        )}
        <Link
          to={insight.action.href}
          className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary hover:underline max-md:min-h-10"
        >
          {insight.action.label}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

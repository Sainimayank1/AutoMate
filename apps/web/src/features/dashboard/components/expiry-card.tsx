import type { ExpiryItem } from "@automate/shared";
import { CircleAlert, CircleDashed, Clock, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATE = {
  expired: { tone: "destructive", icon: CircleAlert, label: "Expired" },
  expiring: { tone: "warning", icon: Clock, label: "Expiring" },
  valid: { tone: "success", icon: ShieldCheck, label: "Valid" },
  not_added: { tone: "neutral", icon: CircleDashed, label: "Not added" },
} satisfies Record<ExpiryItem["state"], { tone: StatusTone; icon: typeof Clock; label: string }>;

/**
 * Stitch "Dashboard" expiry dates: the vehicle's documents with an expiry, soonest first, each
 * opening its document. Until there's an insurance (or warranty) document, the policy on the
 * insurance payment (and the vehicle's warranty) stand in, labelled with their source.
 */
export function ExpiryCard({ items }: { items: ExpiryItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Expiry dates
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <ul className="flex flex-col divide-y">
          {items.map((item) => {
            const state = STATE[item.state];
            const body = (
              <span className="flex flex-col gap-1 py-2.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{item.label}</span>
                  <StatusBadge tone={state.tone} icon={state.icon} label={state.label} />
                </span>
                <span className="text-sm tabular-nums">{item.summary}</span>
                {item.detail && (
                  <span className="text-xs text-muted-foreground">{item.detail}</span>
                )}
              </span>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    to={item.href}
                    className="block rounded-md outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-auto text-xs text-muted-foreground">
          PUC, registration and licence arrive with Documents.
        </p>
      </CardContent>
    </Card>
  );
}

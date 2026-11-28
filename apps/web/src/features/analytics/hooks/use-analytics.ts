import type { AnalyticsOverview, AnalyticsQuery } from "@automate/shared";
import { useQuery } from "@tanstack/react-query";

import { request } from "@/lib/api-client";

/** Under `expenses`: any expense or fill-up write changes the figures. */
export function useAnalytics(query: AnalyticsQuery) {
  return useQuery({
    queryKey: ["expenses", "analytics", query] as const,
    queryFn: () => request<AnalyticsOverview>({ url: "/analytics/overview", params: query }),
    placeholderData: (previous) => previous,
  });
}

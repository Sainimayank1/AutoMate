import { DEFAULT_DASHBOARD_LAYOUT } from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { dashboardService } from "@/features/dashboard/services/dashboard-service";

/** Not under `dashboardKeys.all`: fuel and expense writes don't change the layout. */
export const layoutKey = ["dashboard-layout"] as const;

/**
 * The signed-in user's dashboard layout. `ready` once it's known; if it can't load, the default
 * layout (the dashboard still works).
 */
export function useDashboardLayout() {
  const query = useQuery({
    queryKey: layoutKey,
    queryFn: dashboardService.layout,
    staleTime: Infinity,
  });
  return {
    layout: query.data ?? DEFAULT_DASHBOARD_LAYOUT,
    ready: !query.isPending,
    /** The saved layout is known (not the fallback): only then can it be edited. */
    loaded: query.isSuccess,
  };
}

export function useSaveDashboardLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dashboardService.saveLayout,
    onSuccess: (layout) => {
      queryClient.setQueryData(layoutKey, layout);
      toast.success("Dashboard layout saved.");
    },
  });
}

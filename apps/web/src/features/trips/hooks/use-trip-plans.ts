import type {
  CompleteTripPlanValues,
  CreateTripPlanValues,
  Page,
  TripPlan,
  UpdateTripPlanValues,
} from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { tripsKeys } from "@/features/trips/hooks/trips-keys";
import { handledByForm, useSyncTrips } from "@/features/trips/hooks/use-trips";
import { type TripPlanListParams, tripsService } from "@/features/trips/services/trips-service";

export function useTripPlans(params: TripPlanListParams) {
  return useQuery({
    queryKey: tripsKeys.planList(params),
    queryFn: () => tripsService.plans(params),
    placeholderData: (previous) => previous,
  });
}

export function useTripPlan(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: tripsKeys.plan(id),
    queryFn: () => tripsService.plan(id),
    enabled: !!id,
    placeholderData: () =>
      queryClient
        .getQueriesData<Page<TripPlan>>({ queryKey: tripsKeys.plans })
        .flatMap(([, page]) => page?.items ?? [])
        .find((plan) => plan.id === id),
  });
}

/** Plans never touch the odometer or money: refreshing the planner is enough. */
function useSyncPlans() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: tripsKeys.plans });
}

export function useCreateTripPlan() {
  const sync = useSyncPlans();
  return useMutation({
    mutationFn: (values: CreateTripPlanValues) => tripsService.createPlan(values),
    onSuccess: async () => {
      await sync();
      toast.success("Trip planned.");
    },
    onError: handledByForm,
  });
}

export function useUpdateTripPlan(id: string) {
  const sync = useSyncPlans();
  return useMutation({
    mutationFn: (values: UpdateTripPlanValues) => tripsService.updatePlan(id, values),
    onSuccess: async () => {
      await sync();
      toast.success("Plan updated.");
    },
    onError: handledByForm,
  });
}

export function useCancelTripPlan() {
  const sync = useSyncPlans();
  return useMutation({
    mutationFn: ({ id, cancelled }: { id: string; cancelled: boolean }) =>
      tripsService.setPlanCancelled(id, cancelled),
    onSuccess: async (_, { cancelled }) => {
      await sync();
      toast.success(cancelled ? "Plan cancelled." : "Plan restored.");
    },
  });
}

export function useDeleteTripPlan() {
  const queryClient = useQueryClient();
  const sync = useSyncPlans();
  return useMutation({
    mutationFn: (id: string) => tripsService.removePlan(id),
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: tripsKeys.plan(id) });
      await sync();
      toast.success("Plan deleted.");
    },
  });
}

/** Completing writes a real trip (distance, odometer): refresh everything a trip touches. */
export function useCompleteTripPlan(id: string) {
  const queryClient = useQueryClient();
  const sync = useSyncTrips();
  return useMutation({
    mutationFn: (values: CompleteTripPlanValues) => tripsService.completePlan(id, values),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: tripsKeys.plan(id) });
      await sync();
      toast.success("Trip done and added to your history.");
    },
    onError: handledByForm,
  });
}

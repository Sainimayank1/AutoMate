import type { PushSubscriptionValues } from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { notificationsService } from "@/features/notifications/services/notifications-service";

const WORKER = "/sw.js";

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/** The VAPID public key (base64url) as the bytes the Push API wants. */
function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

const currentSubscription = async () =>
  (await navigator.serviceWorker.getRegistration(WORKER))?.pushManager.getSubscription() ?? null;

/**
 * Push to this device (notifications.md §1): the server's key, whether this browser is already
 * subscribed, and turning it on (permission, worker, subscription) or off.
 */
export function usePushDevice() {
  const client = useQueryClient();
  const supported = pushSupported();
  const config = useQuery({
    queryKey: ["push", "config"],
    queryFn: notificationsService.pushConfig,
    staleTime: Infinity,
  });
  const subscribed = useQuery({
    queryKey: ["push", "subscribed"],
    queryFn: async () => !!(await currentSubscription()),
    enabled: supported,
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["push", "subscribed"] });

  const enable = useMutation({
    mutationFn: async () => {
      const publicKey = config.data?.publicKey;
      if (!publicKey) throw new Error("Push isn't set up on the server yet.");
      if ((await Notification.requestPermission()) !== "granted") {
        throw new Error("Notifications are blocked for AutoMate in this browser's site settings.");
      }
      const registration = await navigator.serviceWorker.register(WORKER);
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      });
      await notificationsService.subscribePush(subscription.toJSON() as PushSubscriptionValues);
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Reminders will arrive on this device.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
  });
  const disable = useMutation({
    mutationFn: async () => {
      const subscription = await currentSubscription();
      if (!subscription) return;
      const { endpoint } = subscription;
      await subscription.unsubscribe();
      await notificationsService.unsubscribePush(endpoint);
    },
    onSuccess: refresh,
  });

  return {
    supported,
    configured: !!config.data?.publicKey,
    blocked: supported && Notification.permission === "denied",
    on: subscribed.data ?? false,
    pending: enable.isPending || disable.isPending || subscribed.isPending,
    enable: () => enable.mutate(),
    disable: () => disable.mutate(),
  };
}

import type { ApiSuccessResponse, AuthSession } from "@automate/shared";
import axios, {
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
  isAxiosError,
} from "axios";

import { normalizeApiError } from "@/lib/api-error";
import { env } from "@/lib/env";
import { useSessionStore } from "@/stores/session-store";

/**
 * The single HTTP client. Feature services use `request` (or this client for
 * envelope `meta` and file downloads); components never call it directly.
 * Every rejected request becomes an ApiError.
 */
export const apiClient = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: 15_000,
  headers: { Accept: "application/json" },
  // Sends the httpOnly refresh cookie, which is cross-origin in development (:5173 → :3000).
  withCredentials: true,
});

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/** Auth routes report their own 401s (wrong password, dead cookie); they must never trigger a refresh. */
const isAuthRoute = (url: string | undefined) => url?.startsWith("/auth/") ?? false;

apiClient.interceptors.request.use((config) => {
  const token = useSessionStore.getState().session?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const apiError = normalizeApiError(error);
    const config = isAxiosError(error) ? (error.config as RetryableConfig | undefined) : undefined;

    // Expired access token: refresh once, then replay the request with the new token.
    if (apiError.status === 401 && config && !config._retried && !isAuthRoute(config.url)) {
      config._retried = true;
      if (await refreshSession()) return apiClient.request(config);
    }
    return Promise.reject(apiError);
  },
);

/**
 * Calls the API and returns the envelope's `data`.
 * e.g. `request<Vehicle[]>({ url: "/vehicles" })`, `request<void>({ method: "DELETE", url })`.
 */
export async function request<TData>(config: AxiosRequestConfig): Promise<TData> {
  const response = await apiClient.request<ApiSuccessResponse<TData>>(config);
  return response.data.data; // a 204 has no body: TData should be void
}

let refreshing: Promise<boolean> | null = null;

/**
 * Tabs share one refresh cookie and the server rotates it on every refresh, so two tabs refreshing
 * at once (e.g. a restored browser session) would knock each other out. A Web Lock makes tabs take
 * turns: each refreshes with the cookie the previous one left.
 */
function oneTabAtATime<T>(task: () => Promise<T>): Promise<T> {
  return typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request("automate:auth-refresh", task)
    : task();
}

/**
 * Trades the refresh cookie for a new session, or marks the user signed out.
 * Runs on page load and after a 401. Concurrent callers in this tab share one request, and
 * other tabs wait their turn (see `oneTabAtATime`): the server rotates the cookie each time.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= oneTabAtATime(() => request<AuthSession>({ method: "POST", url: "/auth/refresh" }))
    .then(({ user, accessToken }) => {
      useSessionStore.getState().setSession({ user, accessToken });
      return true;
    })
    .catch(() => {
      useSessionStore.getState().clearSession();
      return false;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

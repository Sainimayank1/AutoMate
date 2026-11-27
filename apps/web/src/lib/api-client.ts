import type { ApiSuccessResponse } from "@automate/shared";
import axios, { type AxiosRequestConfig } from "axios";

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
});

apiClient.interceptors.request.use((config) => {
  const token = useSessionStore.getState().session?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = normalizeApiError(error);
    // shortcut: drop the session on 401; refresh-token retry arrives with the auth phase.
    if (apiError.status === 401) useSessionStore.getState().clearSession();
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

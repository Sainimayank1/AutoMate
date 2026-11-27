import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";

import { normalizeApiError } from "@/lib/api-error";

/** Root error key used for server-side form errors; render with <FormError>. */
export const SERVER_ERROR_KEY = "root.server" as const;

/**
 * Puts an API failure onto a react-hook-form form: each field error on its field,
 * and the overall message on the form root (so errors for unknown fields are never lost).
 */
export function applyServerErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: unknown,
): void {
  const apiError = normalizeApiError(error);
  for (const [field, message] of Object.entries(apiError.fieldErrors)) {
    setError(field as FieldPath<T>, { type: "server", message });
  }
  setError(SERVER_ERROR_KEY, { type: "server", message: apiError.message });
}

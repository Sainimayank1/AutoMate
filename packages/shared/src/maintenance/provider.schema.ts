import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";
import { blankToNull, optionalText } from "../common/fields.js";
import type { MaintenanceProvider } from "./maintenance.schema.js";

/** Workshops contract (module 5): the user's service providers, shared by all their vehicles. */

export const ProviderType = {
  AUTHORISED: "AUTHORISED",
  INDEPENDENT: "INDEPENDENT",
  TYRES: "TYRES",
  BATTERY: "BATTERY",
  BODY_SHOP: "BODY_SHOP",
  DETAILING: "DETAILING",
  ROADSIDE: "ROADSIDE",
  OTHER: "OTHER",
} as const;
export type ProviderType = (typeof ProviderType)[keyof typeof ProviderType];

export const providerFieldsSchema = z.object({
  /** Optional client-generated id: a retried save returns the same workshop. */
  id: z.uuid("Invalid id").optional(),
  name: z.string().trim().min(1, "Enter a name").max(120, "Use 120 characters or fewer"),
  type: z.enum(ProviderType, { error: "Choose a type" }),
  phone: z
    .preprocess(
      blankToNull,
      z
        .string()
        .trim()
        .regex(/^\+?[\d\s()-]{6,20}$/, "Enter a phone number")
        .nullable(),
    )
    .optional(),
  email: z.preprocess(blankToNull, z.email("Enter a valid email").max(120).nullable()).optional(),
  address: optionalText(200),
  city: optionalText(60),
  /** Shown first in suggestions and lists. */
  preferred: z.boolean().optional(),
  notes: optionalText(1000),
});

export const createProviderSchema = providerFieldsSchema;
export const updateProviderSchema = providerFieldsSchema.omit({ id: true }).partial();

/** `GET /maintenance-providers`: preferred first, then by name; archived ones only on request. */
export const providerListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(80).optional(),
  preferred: z.stringbool().optional(),
  archived: z.stringbool().default(false),
});

export type CreateProviderValues = z.output<typeof createProviderSchema>;
export type UpdateProviderValues = z.output<typeof updateProviderSchema>;
export type ProviderListQuery = z.output<typeof providerListQuerySchema>;

// ---- responses

export interface ProviderProfile extends MaintenanceProvider {
  type: ProviderType;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  preferred: boolean;
  notes: string | null;
  archivedAt: string | null;
  /** Its service records across the user's vehicles; `spent` is read from their expenses. */
  stats: { visits: number; firstVisit: string | null; lastVisit: string | null; spent: string };
  createdAt: string;
  updatedAt: string;
}

import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";

/** What app-wide search looks through, in the order results are grouped. */
export const SEARCH_KINDS = [
  "vehicle",
  "expense",
  "fuel",
  "service",
  "workshop",
  "document",
  "trip",
  "reminder",
] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export const SEARCH_MIN_LENGTH = 2;

/** `GET /search`: the user's own records whose names, numbers or notes contain `q`. */
export const searchQuerySchema = paginationQuerySchema.extend({
  q: z
    .string()
    .trim()
    .min(SEARCH_MIN_LENGTH, `Type at least ${SEARCH_MIN_LENGTH} characters`)
    .max(80, "Use 80 characters or fewer"),
});
export type SearchQuery = z.output<typeof searchQuerySchema>;

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  /** "₹850.00 · 21 Nov 2026", "HR26EV4821", the vehicle... */
  subtitle: string | null;
  /** Where it opens. */
  href: string;
}

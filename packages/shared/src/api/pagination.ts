import { z } from "zod";

/**
 * Every list endpoint is paginated the same way (docs/architecture/api-conventions.md §2):
 * `?page=1&pageSize=20` in, the page as `data` and a `PageMeta` as the envelope's `meta` out.
 */
export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number<number>().int().min(1, "Pages start at 1").default(1),
  pageSize: z.coerce
    .number<number>()
    .int()
    .min(1)
    .max(PAGE_SIZE_MAX, `At most ${PAGE_SIZE_MAX} per page`)
    .default(PAGE_SIZE_DEFAULT),
});

export type PaginationQuery = z.output<typeof paginationQuerySchema>;

/** `meta` of a list response. A page past the end is empty, not an error. */
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** A list response as the web reads it: the page's items plus its meta. */
export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

export function pageMeta({ page, pageSize }: PaginationQuery, total: number): PageMeta {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

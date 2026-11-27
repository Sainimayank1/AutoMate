import { type PageMeta, pageMeta, type PaginationQuery } from "@automate/shared";

/**
 * What a list endpoint returns. `ResponseEnvelopeInterceptor` sends `items` as `data` and `meta`
 * as the envelope's `meta`, so every list behaves the same (api-conventions.md §2).
 */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly meta: PageMeta,
  ) {}

  /** One page of a list already in memory (e.g. rows that needed a whole-history calculation). */
  static of<T>(all: T[], query: PaginationQuery): Paginated<T> {
    const start = (query.page - 1) * query.pageSize;
    return new Paginated(all.slice(start, start + query.pageSize), pageMeta(query, all.length));
  }
}

/** Prisma `skip`/`take` for a page; pair it with a `count` for the meta. */
export const pageArgs = ({ page, pageSize }: PaginationQuery) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

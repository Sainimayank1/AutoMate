import type { SearchResult } from "@automate/shared";

import { requestPage } from "@/lib/api-client";

export const searchService = {
  search: (q: string, page = 1) =>
    requestPage<SearchResult>({ url: "/search", params: { q, page, pageSize: 30 } }),
};

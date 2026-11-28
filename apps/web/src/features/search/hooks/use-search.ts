import { SEARCH_MIN_LENGTH } from "@automate/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { searchService } from "@/features/search/services/search-service";

const DEBOUNCE_MS = 250;

/** Results for what's typed, once it's long enough and the typing pauses. */
export function useSearch(text: string) {
  const [query, setQuery] = useState(text.trim());
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);
  const enabled = query.length >= SEARCH_MIN_LENGTH;
  const result = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchService.search(query),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  return { ...result, query, enabled, settling: text.trim() !== query };
}

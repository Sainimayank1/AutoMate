import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/utils/format";

type PagerProps = {
  /** 1-based, like the API's `page`. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
};

/** "Page 2 of 5" with previous/next, for client-side tables and server-paged lists alike. */
export function Pager({ page, pageCount, onPageChange, className }: PagerProps) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex items-center justify-between gap-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <span>
        Page {formatNumber(page)} of {formatNumber(pageCount)}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}

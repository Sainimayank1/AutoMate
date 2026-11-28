import { cn } from "cn";

/** The AutoMate mark from the Stitch design: a flat cyan "A" on a graphite tile. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
    >
      <rect width="28" height="28" rx="6" className="fill-secondary" />
      <path d="M14 5L22 21H18.4L14 11.8L9.6 21H6L14 5Z" className="fill-brand" />
      <path d="M10.8 17.5H17.2" className="stroke-brand" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type BrandLogoProps = {
  /** `lg` for auth pages, `md` for the sidebar and mobile headers. */
  size?: "md" | "lg";
  className?: string;
};

/** Mark + wordmark lockup. Never paste the SVG into pages; use this. */
export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className={size === "lg" ? "size-8" : "size-7"} />
      <span
        className={cn(
          "font-heading font-medium text-foreground",
          size === "lg" ? "text-xl" : "text-lg",
        )}
      >
        AutoMate
      </span>
    </span>
  );
}

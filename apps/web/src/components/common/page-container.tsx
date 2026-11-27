import { cn } from "cn";

/** Standard page width and gutters. Every routed page renders inside one. */
export function PageContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8",
        className,
      )}
      {...props}
    />
  );
}

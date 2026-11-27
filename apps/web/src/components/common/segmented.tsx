import { cn } from "cn";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * One choice of a few (Stitch segmented control). A single-choice ToggleGroup: a radio group
 * with arrow-key navigation and one tab stop.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  ...aria
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      // A radio group always has a choice: ignore clicks on the chosen one.
      onValueChange={(next) => next && onChange(next as T)}
      spacing={1}
      className={cn("rounded-lg border bg-muted p-1", className)}
      {...aria}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          size="sm"
          className="data-[state=on]:bg-secondary data-[state=on]:text-primary"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

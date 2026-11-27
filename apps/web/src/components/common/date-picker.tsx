import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/utils/format";

type DatePickerProps = {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  /** Dates that can't be picked, e.g. future dates for a fuel entry. */
  disabledDates?: React.ComponentProps<typeof Calendar>["disabled"];
  "aria-invalid"?: boolean;
};

/** Popover + Calendar composition (shadcn has no single date-picker component). Shows DD/MM/YYYY. */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  id,
  disabled,
  disabledDates,
  "aria-invalid": ariaInvalid,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          className="w-full justify-start font-normal data-[empty=true]:text-muted-foreground"
          data-empty={!value}
        >
          <CalendarIcon data-icon="inline-start" />
          {value ? formatDate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          // Month and year dropdowns: purchase and registration dates are often years back.
          captionLayout="dropdown"
          startMonth={new Date(1950, 0)}
          endMonth={new Date(new Date().getFullYear() + 15, 11)}
          selected={value}
          defaultMonth={value}
          disabled={disabledDates}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

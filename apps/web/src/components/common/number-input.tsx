import { cn } from "cn";
import type { Ref } from "react";
import { NumericFormat } from "react-number-format";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

type NumberInputProps = {
  /** The raw value without grouping ("100000"); a form keeps it as a string. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  ref?: Ref<HTMLInputElement>;
  id?: string;
  name?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  /** Decimal places allowed; 0 for whole numbers. */
  decimals?: number;
  /** Amber border: allowed but worth a second look (e.g. a lowered odometer). */
  warning?: boolean;
};

/**
 * A number typed with Indian grouping (1,00,000) and an optional unit on either side.
 * Spread a `FormField` render's props onto it; the shared schemas strip the commas.
 */
export function NumberInput({
  value,
  onChange,
  onBlur,
  ref,
  prefix,
  suffix,
  decimals = 0,
  warning,
  ...props
}: NumberInputProps) {
  return (
    <InputGroup className={cn("h-10", warning && "border-warning")}>
      {prefix && (
        <InputGroupAddon>
          <InputGroupText>{prefix}</InputGroupText>
        </InputGroupAddon>
      )}
      <NumericFormat
        {...props}
        customInput={InputGroupInput}
        getInputRef={ref}
        value={value}
        onValueChange={(values, { source }) => {
          // Only typing changes the form; a value set by code (e.g. a computed total) doesn't echo back.
          if (source === "event") onChange(values.value);
        }}
        onBlur={onBlur}
        inputMode={decimals ? "decimal" : "numeric"}
        thousandSeparator=","
        thousandsGroupStyle="lakh"
        decimalScale={decimals}
        allowNegative={false}
        className="font-mono tabular-nums"
      />
      {suffix && (
        <InputGroupAddon align="inline-end">
          <InputGroupText>{suffix}</InputGroupText>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

import {
  checkExpense,
  CostClass,
  type CreateExpenseValues,
  expenseAllocationSchema,
  type ExpenseCategory,
  type ExpenseDetail,
  expenseFieldsSchema,
  FINANCE_COMPONENT_BY_KEY,
  type FinanceComponent,
  INSURANCE_POLICY_KEYS,
  type PaymentMethod,
} from "@automate/shared";
import { format } from "date-fns";
import { z } from "zod";

/**
 * Form state for adding and editing an expense: inputs hold strings; `expenseFormSchema` (the
 * shared rules) turns them into the API payload. The allocation keeps both the single vehicle and
 * the shared list, so switching modes loses nothing.
 */
export type ExpenseFormValues = {
  allocation: {
    mode: "single" | "shared";
    vehicleId: string;
    split: "equal" | "custom";
    vehicles: { vehicleId: string; amount: string }[];
  };
  categoryId: string;
  subcategoryId: string;
  title: string;
  amount: string;
  date: string;
  paymentMethod: PaymentMethod | "";
  vendor: string;
  odometerKm: string;
  description: string;
  notes: string;
  principalAmount: string;
  interestAmount: string;
  chargesAmount: string;
  loanReference: string;
  loanOutstanding: string;
  serviceType: string;
  partsReplaced: string;
  partsAmount: string;
  labourAmount: string;
  warrantyUntil: string;
  provider: string;
  policyNumber: string;
  policyStart: string;
  policyEnd: string;
};

const allocationForm = z
  .object({
    mode: z.enum(["single", "shared"]),
    vehicleId: z.string(),
    split: z.enum(["equal", "custom"]),
    vehicles: z.array(z.object({ vehicleId: z.string(), amount: z.string() })),
  })
  .transform((value): z.input<typeof expenseAllocationSchema> =>
    value.mode === "single"
      ? { mode: "single", vehicleId: value.vehicleId }
      : {
          mode: "shared",
          split: value.split,
          vehicles: value.vehicles.map((item) => ({
            vehicleId: item.vehicleId,
            amount: value.split === "custom" ? item.amount : undefined,
          })),
        },
  )
  .pipe(expenseAllocationSchema);

/** The shared expense rules over the form's shape. */
export const expenseFormSchema = expenseFieldsSchema
  .omit({ id: true, allocation: true })
  .extend({ allocation: allocationForm })
  .superRefine(checkExpense);

export type ExpenseFormOutput = z.output<typeof expenseFormSchema>;

/** Fields that only make sense for one kind of category; cleared when the category changes. */
export const CATEGORY_FIELDS = [
  "principalAmount",
  "interestAmount",
  "chargesAmount",
  "loanReference",
  "loanOutstanding",
  "serviceType",
  "partsReplaced",
  "partsAmount",
  "labourAmount",
  "warrantyUntil",
  "provider",
  "policyNumber",
  "policyStart",
  "policyEnd",
] as const satisfies readonly (keyof ExpenseFormValues)[];

/** Which extra section a category gets (Stitch "Add Expense" §4 Additional information). */
export type CategoryKind = "finance" | "maintenance" | "repairs" | "insurance" | null;

export function categoryKind(
  category: ExpenseCategory | undefined,
  subcategory: ExpenseCategory | undefined,
): CategoryKind {
  if (!category) return null;
  if (category.costClass === CostClass.FINANCING) return "finance";
  if (category.key === "MAINTENANCE") return "maintenance";
  if (category.key === "REPAIRS") return "repairs";
  if (subcategory?.key && (INSURANCE_POLICY_KEYS as readonly string[]).includes(subcategory.key)) {
    return "insurance";
  }
  return null;
}

/** A Finance subcategory's preset ("Loan interest" is all interest); null means enter the split. */
export const financePreset = (
  subcategory: ExpenseCategory | undefined,
): FinanceComponent | null => {
  const preset = subcategory?.key ? FINANCE_COMPONENT_BY_KEY[subcategory.key] : undefined;
  return preset && preset !== "SPLIT" ? preset : null;
};

/** The API payload: a preset loan subcategory puts the whole amount in its component. */
export function toExpensePayload(
  values: ExpenseFormOutput,
  preset: FinanceComponent | null,
): Omit<CreateExpenseValues, "id"> {
  if (!preset) return values;
  return {
    ...values,
    principalAmount: preset === "PRINCIPAL" ? values.amount : null,
    interestAmount: preset === "INTEREST" ? values.amount : null,
    chargesAmount: preset === "CHARGES" ? values.amount : null,
  };
}

const today = () => format(new Date(), "yyyy-MM-dd");
const text = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);
/** "16684.00" → "16684": what a person would type. */
const trim = (value: string | null | undefined) => (value ? value.replace(/\.00$/, "") : "");

export function emptyExpenseForm(vehicleId: string): ExpenseFormValues {
  return {
    allocation: { mode: "single", vehicleId, split: "equal", vehicles: [] },
    categoryId: "",
    subcategoryId: "",
    title: "",
    amount: "",
    date: today(),
    paymentMethod: "",
    vendor: "",
    odometerKm: "",
    description: "",
    notes: "",
    ...(Object.fromEntries(CATEGORY_FIELDS.map((key) => [key, ""])) as Pick<
      ExpenseFormValues,
      (typeof CATEGORY_FIELDS)[number]
    >),
  };
}

/** Editing (or duplicating, with today's date): the stored expense back in form shape. */
/** Loaded split of a preset loan type would go stale when the amount changes: it's derived on save. */
const hasPresetSplit = (expense: ExpenseDetail) => {
  const preset = expense.subcategory?.key
    ? FINANCE_COMPONENT_BY_KEY[expense.subcategory.key]
    : undefined;
  return !!preset && preset !== "SPLIT";
};

export function toExpenseForm(
  expense: ExpenseDetail,
  { duplicate = false } = {},
): ExpenseFormValues {
  const shared = expense.group.length > 1;
  return {
    allocation: shared
      ? {
          mode: "shared",
          vehicleId: expense.vehicleId,
          split: "custom",
          vehicles: expense.group.map((share) => ({
            vehicleId: share.vehicleId,
            amount: trim(share.amount),
          })),
        }
      : { mode: "single", vehicleId: expense.vehicleId, split: "equal", vehicles: [] },
    categoryId: expense.category.id,
    subcategoryId: expense.subcategory?.id ?? "",
    title: expense.title,
    amount: trim(shared ? expense.shared?.totalAmount : expense.amount),
    date: duplicate ? today() : expense.date,
    paymentMethod: expense.paymentMethod ?? "",
    vendor: text(expense.vendor),
    odometerKm: duplicate ? "" : text(expense.odometerKm),
    description: text(expense.description),
    notes: text(expense.notes),
    principalAmount: hasPresetSplit(expense) ? "" : trim(expense.finance?.principal),
    interestAmount: hasPresetSplit(expense) ? "" : trim(expense.finance?.interest),
    chargesAmount: hasPresetSplit(expense) ? "" : trim(expense.finance?.charges),
    loanReference: text(expense.finance?.loanReference),
    loanOutstanding: trim(expense.finance?.loanOutstanding),
    serviceType: text(expense.details.serviceType),
    partsReplaced: text(expense.details.partsReplaced),
    partsAmount: trim(expense.details.partsAmount),
    labourAmount: trim(expense.details.labourAmount),
    warrantyUntil: text(expense.details.warrantyUntil),
    provider: text(expense.details.provider),
    policyNumber: text(expense.details.policyNumber),
    policyStart: text(expense.details.policyStart),
    policyEnd: text(expense.details.policyEnd),
  };
}

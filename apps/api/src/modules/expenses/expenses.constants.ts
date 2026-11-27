import {
  CostClass,
  ExpenseKind,
  ExpenseSource,
  LoanMethod,
  PaymentMethod,
  PaymentState,
  RecurrenceUnit,
  RecurringStatus,
  RefundReason,
} from "@automate/shared";
import type { ApiResponseSchemaHost } from "@nestjs/swagger";

type Schema = ApiResponseSchemaHost["schema"];

const money = (example: string, nullable = false): Schema => ({
  type: "string",
  nullable,
  example,
});
const text = (example?: string): Schema => ({ type: "string", nullable: true, example });
const date = (example?: string): Schema => ({
  type: "string",
  format: "date",
  nullable: true,
  example,
});

const CATEGORY_REF: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    key: text("DAILY_USAGE.TOLL"),
    name: { type: "string", example: "Toll" },
    icon: { type: "string", example: "route" },
    costClass: { type: "string", enum: Object.values(CostClass) },
  },
};

/** OpenAPI shape of `Expense` (@automate/shared). */
export const EXPENSE_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid" },
    kind: { type: "string", enum: Object.values(ExpenseKind) },
    title: { type: "string", example: "Delhi–Jaipur Expressway" },
    amount: money("640.00"),
    date: { type: "string", format: "date", example: "2026-11-21" },
    category: CATEGORY_REF,
    subcategory: { ...CATEGORY_REF, nullable: true },
    paymentMethod: { type: "string", nullable: true, enum: Object.values(PaymentMethod) },
    vendor: text("NHAI FASTag"),
    odometerKm: { type: "integer", nullable: true },
    description: text(),
    notes: text(),
    source: { type: "string", enum: Object.values(ExpenseSource) },
    sourceId: { type: "string", format: "uuid", nullable: true },
    editable: { type: "boolean" },
    refundOfId: { type: "string", format: "uuid", nullable: true },
    refundReason: { type: "string", nullable: true, enum: Object.values(RefundReason) },
    refundedAmount: money("0.00"),
    shared: {
      type: "object",
      nullable: true,
      properties: {
        groupId: { type: "string", format: "uuid" },
        totalAmount: money("1000.00"),
        vehicleCount: { type: "integer", example: 2 },
      },
    },
    finance: {
      type: "object",
      nullable: true,
      properties: {
        principal: money("10950.00", true),
        interest: money("5734.00", true),
        charges: money("0.00", true),
        loanReference: text("HDFC-AL-0042"),
        loanOutstanding: money("713295.00", true),
        loanId: { type: "string", format: "uuid", nullable: true },
      },
    },
    details: {
      type: "object",
      properties: {
        serviceType: text(),
        partsReplaced: text(),
        partsAmount: money("0.00", true),
        labourAmount: money("0.00", true),
        warrantyUntil: date(),
        provider: text(),
        policyNumber: text(),
        policyStart: date(),
        policyEnd: date(),
      },
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

export const EXPENSE_DETAIL_SCHEMA: Schema = {
  type: "object",
  allOf: [EXPENSE_SCHEMA],
  properties: {
    refunds: { type: "array", items: EXPENSE_SCHEMA },
    group: {
      type: "array",
      items: {
        type: "object",
        properties: {
          expenseId: { type: "string", format: "uuid" },
          vehicleId: { type: "string", format: "uuid" },
          amount: money("500.00"),
        },
      },
    },
  },
};

export const BULK_RESULT_SCHEMA: Schema = {
  type: "object",
  properties: { affected: { type: "integer" }, skipped: { type: "integer" } },
};

/** OpenAPI shape of `ExpenseCategory` (@automate/shared). */
export const EXPENSE_CATEGORY_SCHEMA: Schema = {
  type: "object",
  properties: {
    ...CATEGORY_REF.properties,
    parentId: { type: "string", format: "uuid", nullable: true },
    custom: { type: "boolean" },
    active: { type: "boolean" },
    usage: { type: "integer", example: 12 },
    subcategories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ...CATEGORY_REF.properties,
          parentId: { type: "string", format: "uuid", nullable: true },
          custom: { type: "boolean" },
          active: { type: "boolean" },
          usage: { type: "integer", example: 3 },
        },
      },
    },
  },
};

const decimalOrNull = (example: string): Schema => ({ type: "string", nullable: true, example });

/** OpenAPI shape of `ExpenseSummary` (@automate/shared). */
export const EXPENSE_SUMMARY_SCHEMA: Schema = {
  type: "object",
  properties: {
    month: { type: "string", example: "2026-11" },
    operating: {
      type: "object",
      properties: {
        thisMonth: money("11840.00"),
        lastMonth: money("12590.00"),
        lastMonthWindow: {
          type: "object",
          properties: {
            from: { type: "string", format: "date", example: "2026-10-01" },
            to: { type: "string", format: "date", example: "2026-10-27" },
          },
        },
        changePercent: { type: "integer", nullable: true, example: -6 },
        thisYear: money("87710.00"),
        monthsCovered: { type: "integer", example: 9 },
        monthlyAverage: decimalOrNull("9745.56"),
      },
    },
    costPerKm: decimalOrNull("10.38"),
    distanceKm: { type: "integer", nullable: true, example: 8438 },
    loanOutflowThisMonth: money("16684.00"),
    cashOutflowThisMonth: money("28524.00"),
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: CATEGORY_REF,
          amount: money("7120.00"),
          percent: { type: "number", example: 60.1 },
        },
      },
    },
  },
};

/** OpenAPI shape of `RecurringPayment` (@automate/shared). */
export const RECURRING_PAYMENT_SCHEMA: Schema = {
  type: "object",
  properties: {
    recurringId: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid" },
    title: { type: "string", example: "HDFC Bank EMI" },
    category: CATEGORY_REF,
    dueDate: date("2026-12-05"),
    date: date("2026-12-05"),
    amount: money("16607.00"),
    state: { type: "string", enum: Object.values(PaymentState) },
    postponed: { type: "boolean" },
    expenseId: { type: "string", format: "uuid", nullable: true },
    loan: {
      type: "object",
      nullable: true,
      properties: {
        loanId: { type: "string", format: "uuid" },
        number: { type: "integer", example: 20 },
        of: { type: "integer", example: 60 },
        principal: money("12129.00"),
        interest: money("4478.00"),
      },
    },
  },
};

/** OpenAPI shape of `RecurringExpense` (@automate/shared). */
export const RECURRING_EXPENSE_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid" },
    title: { type: "string", example: "Society parking pass" },
    amount: money("1500.00"),
    category: CATEGORY_REF,
    subcategory: { ...CATEGORY_REF, nullable: true },
    paymentMethod: { type: "string", nullable: true, enum: Object.values(PaymentMethod) },
    vendor: text("Prestige Towers RWA"),
    notes: text(),
    every: { type: "integer", example: 1 },
    unit: { type: "string", enum: Object.values(RecurrenceUnit) },
    startDate: date("2026-01-05"),
    endDate: { ...date(), nullable: true },
    reminderDays: { type: "integer", example: 3 },
    status: { type: "string", enum: Object.values(RecurringStatus) },
    loanId: { type: "string", format: "uuid", nullable: true },
    next: { ...RECURRING_PAYMENT_SCHEMA, nullable: true },
    overdue: { type: "integer", example: 0 },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

/** OpenAPI shape of `VehicleLoan` (@automate/shared). */
export const VEHICLE_LOAN_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid" },
    lender: { type: "string", example: "HDFC Bank" },
    accountNumber: text("AL-0042"),
    principal: money("800000.00"),
    annualRate: money("9.00"),
    tenureMonths: { type: "integer", example: 60 },
    firstEmiDate: date("2025-05-05"),
    method: { type: "string", enum: Object.values(LoanMethod) },
    processingFee: money("5000.00", true),
    emi: money("16607.00"),
    outstanding: money("563204.00"),
    paid: {
      type: "object",
      properties: {
        principal: money("236796.00"),
        interest: money("95345.00"),
        charges: money("0.00"),
        emis: { type: "integer", example: 19 },
      },
    },
    beforeTracking: {
      type: "object",
      description: "EMIs due before the loan was added here (paid outside AutoMate), per schedule",
      properties: {
        emis: { type: "integer", example: 0 },
        principal: money("0.00"),
        interest: money("0.00"),
      },
    },
    repaid: {
      type: "object",
      description: "Recorded here plus before tracking",
      properties: {
        emis: { type: "integer", example: 19 },
        principal: money("236796.00"),
        interest: money("95345.00"),
      },
    },
    emisTotal: { type: "integer", example: 60 },
    endDate: date("2030-04-05"),
    totalInterest: money("196412.00"),
    next: {
      type: "object",
      nullable: true,
      properties: {
        date: date("2026-12-05"),
        amount: money("16607.00"),
        principal: money("12383.00"),
        interest: money("4224.00"),
      },
    },
    recurringId: { type: "string", format: "uuid", nullable: true },
    rateChanges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          effectiveFrom: date("2026-01-01"),
          annualRate: money("9.50"),
          keepEmi: { type: "boolean" },
        },
      },
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

/** OpenAPI shape of `LoanScheduleRow` (@automate/shared). */
export const LOAN_SCHEDULE_ROW_SCHEMA: Schema = {
  type: "object",
  properties: {
    number: { type: "integer", example: 1 },
    date: date("2025-05-05"),
    annualRate: money("9.00"),
    openingBalance: money("800000.00"),
    emi: money("16607.00"),
    interest: money("6000.00"),
    principal: money("10607.00"),
    prepayment: money("0.00"),
    closingBalance: money("789393.00"),
    state: {
      type: "string",
      nullable: true,
      enum: Object.values(PaymentState),
      description: "null: before tracking started (paid outside AutoMate, not recorded here)",
    },
    expenseId: { type: "string", format: "uuid", nullable: true },
  },
};

/** OpenAPI shape of `ExpenseTrend` (@automate/shared). */
export const EXPENSE_TREND_SCHEMA: Schema = {
  type: "object",
  properties: {
    months: {
      type: "array",
      items: {
        type: "object",
        properties: {
          month: { type: "string", example: "2026-11" },
          total: money("11840.00"),
          groups: { type: "object", additionalProperties: money("0.00") },
          lastYear: money("9920.00", true),
        },
      },
    },
    total: money("118430.00"),
    previousTotal: money("96210.00", true),
  },
};

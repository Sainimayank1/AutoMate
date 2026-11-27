import {
  CostClass,
  ExpenseKind,
  ExpenseSource,
  PaymentMethod,
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
    subcategories: { type: "array", items: { ...CATEGORY_REF } },
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

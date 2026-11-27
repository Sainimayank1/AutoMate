import {
  bulkExpenseIdsSchema,
  bulkRecategoriseSchema,
  createExpenseCategorySchema,
  createExpenseSchema,
  createRefundSchema,
  expenseCategoryListQuerySchema,
  expenseListQuerySchema,
  expenseSummaryQuerySchema,
  updateExpenseCategorySchema,
  updateExpenseSchema,
} from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class CreateExpenseDto extends createZodDto(createExpenseSchema) {}
export class UpdateExpenseDto extends createZodDto(updateExpenseSchema) {}
export class ExpenseListQueryDto extends createZodDto(expenseListQuerySchema) {}
export class ExpenseSummaryQueryDto extends createZodDto(expenseSummaryQuerySchema) {}
export class CreateRefundDto extends createZodDto(createRefundSchema) {}
export class BulkExpenseIdsDto extends createZodDto(bulkExpenseIdsSchema) {}
export class BulkRecategoriseDto extends createZodDto(bulkRecategoriseSchema) {}

export class CreateExpenseCategoryDto extends createZodDto(createExpenseCategorySchema) {}
export class UpdateExpenseCategoryDto extends createZodDto(updateExpenseCategorySchema) {}
export class ExpenseCategoryListQueryDto extends createZodDto(expenseCategoryListQuerySchema) {}

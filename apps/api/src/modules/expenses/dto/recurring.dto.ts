import {
  budgetListQuerySchema,
  createBudgetSchema,
  createRecurringExpenseSchema,
  createVehicleLoanSchema,
  loanRateChangeSchema,
  paginationQuerySchema,
  payRecurringSchema,
  postponeRecurringSchema,
  recurringListQuerySchema,
  recurringPaymentsQuerySchema,
  updateBudgetSchema,
  updateRecurringExpenseSchema,
  updateVehicleLoanSchema,
  vehicleLoanListQuerySchema,
} from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class CreateRecurringExpenseDto extends createZodDto(createRecurringExpenseSchema) {}
export class UpdateRecurringExpenseDto extends createZodDto(updateRecurringExpenseSchema) {}
export class RecurringListQueryDto extends createZodDto(recurringListQuerySchema) {}
export class RecurringPaymentsQueryDto extends createZodDto(recurringPaymentsQuerySchema) {}
export class PayRecurringDto extends createZodDto(payRecurringSchema) {}
export class PostponeRecurringDto extends createZodDto(postponeRecurringSchema) {}

export class CreateVehicleLoanDto extends createZodDto(createVehicleLoanSchema) {}
export class UpdateVehicleLoanDto extends createZodDto(updateVehicleLoanSchema) {}
export class VehicleLoanListQueryDto extends createZodDto(vehicleLoanListQuerySchema) {}
export class LoanRateChangeDto extends createZodDto(loanRateChangeSchema) {}
export class LoanScheduleQueryDto extends createZodDto(paginationQuerySchema) {}

export class CreateBudgetDto extends createZodDto(createBudgetSchema) {}
export class UpdateBudgetDto extends createZodDto(updateBudgetSchema) {}
export class BudgetListQueryDto extends createZodDto(budgetListQuerySchema) {}

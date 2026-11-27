import type {
  BulkResult,
  Expense,
  ExpenseDetail,
  ExpenseSummary,
  ExpenseTrend,
} from "@automate/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import type { Paginated } from "@/common/pagination/paginated";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";

import {
  BulkExpenseIdsDto,
  BulkRecategoriseDto,
  CreateExpenseDto,
  CreateRefundDto,
  ExpenseListQueryDto,
  ExpenseSummaryQueryDto,
  UpdateExpenseDto,
} from "./dto/expense.dto";
import {
  BULK_RESULT_SCHEMA,
  EXPENSE_DETAIL_SCHEMA,
  EXPENSE_SCHEMA,
  EXPENSE_SUMMARY_SCHEMA,
  EXPENSE_TREND_SCHEMA,
} from "./expenses.constants";
import { ExpensesService } from "./expenses.service";

/** Expenses across all the user's vehicles (`?vehicleId=` narrows to one). */
@ApiTags("expenses")
@ApiBearerAuth()
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @ApiOperation({ summary: "Expenses, newest first, filtered and a page at a time" })
  @ApiEnvelopeResponse(EXPENSE_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ExpenseListQueryDto,
  ): Promise<Paginated<Expense>> {
    return this.expenses.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: "Add an expense (one vehicle, or shared across several)" })
  @ApiEnvelopeResponse(EXPENSE_DETAIL_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateExpenseDto): Promise<ExpenseDetail> {
    return this.expenses.create(user.id, body);
  }

  // Declared before `:id` routes so "summary" and "bulk" are never read as ids.
  @Get("summary")
  @ApiOperation({ summary: "Overview figures for this month and year (one vehicle or all)" })
  @ApiEnvelopeResponse(EXPENSE_SUMMARY_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  summary(
    @CurrentUser() user: AuthUser,
    @Query() query: ExpenseSummaryQueryDto,
  ): Promise<ExpenseSummary> {
    return this.expenses.summary(user.id, query);
  }

  @Get("trend")
  @ApiOperation({ summary: "The last 12 months by chart group, beside the same months a year ago" })
  @ApiEnvelopeResponse(EXPENSE_TREND_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  trend(
    @CurrentUser() user: AuthUser,
    @Query() query: ExpenseSummaryQueryDto,
  ): Promise<ExpenseTrend> {
    return this.expenses.trend(user.id, query);
  }

  @Post("bulk/delete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete several expenses (linked ones are skipped)" })
  @ApiEnvelopeResponse(BULK_RESULT_SCHEMA)
  @ApiErrorResponses(400, 401)
  bulkDelete(@CurrentUser() user: AuthUser, @Body() body: BulkExpenseIdsDto): Promise<BulkResult> {
    return this.expenses.bulkDelete(user.id, body.ids);
  }

  @Post("bulk/category")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Move several expenses to another category (linked ones are skipped)" })
  @ApiEnvelopeResponse(BULK_RESULT_SCHEMA)
  @ApiErrorResponses(400, 401)
  bulkRecategorise(
    @CurrentUser() user: AuthUser,
    @Body() body: BulkRecategoriseDto,
  ): Promise<BulkResult> {
    return this.expenses.bulkRecategorise(user.id, body);
  }

  @Get(":id")
  @ApiOperation({ summary: "One expense with its refunds and shared group" })
  @ApiEnvelopeResponse(EXPENSE_DETAIL_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ExpenseDetail> {
    return this.expenses.get(user.id, id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update an expense (a shared one as a whole; linked ones are read-only)",
  })
  @ApiEnvelopeResponse(EXPENSE_DETAIL_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateExpenseDto,
  ): Promise<ExpenseDetail> {
    return this.expenses.update(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an expense (with its refunds, and its whole shared group)" })
  @ApiErrorResponses(400, 401, 404, 409)
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.expenses.remove(user.id, id);
  }

  @Post(":id/refunds")
  @ApiOperation({ summary: "Record a refund, reimbursement or adjustment against an expense" })
  @ApiEnvelopeResponse(EXPENSE_DETAIL_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  refund(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: CreateRefundDto,
  ): Promise<ExpenseDetail> {
    return this.expenses.refund(user.id, id, body);
  }
}

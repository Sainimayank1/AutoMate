import { type RecurringExpense, type RecurringPayment, RecurringStatus } from "@automate/shared";
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
import { IsoDatePipe } from "@/common/pipes/iso-date.pipe";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";

import {
  CreateRecurringExpenseDto,
  PayRecurringDto,
  PostponeRecurringDto,
  RecurringListQueryDto,
  RecurringPaymentsQueryDto,
  UpdateRecurringExpenseDto,
} from "./dto/recurring.dto";
import { RECURRING_EXPENSE_SCHEMA, RECURRING_PAYMENT_SCHEMA } from "./expenses.constants";
import { RecurringExpensesService } from "./recurring-expenses.service";

/** Recurring payments: schedules, and each due date paid, skipped or postponed. */
@ApiTags("recurring-expenses")
@ApiBearerAuth()
@Controller("recurring-expenses")
export class RecurringExpensesController {
  constructor(private readonly recurring: RecurringExpensesService) {}

  @Get()
  @ApiOperation({ summary: "Recurring payment schedules, each with its next due date" })
  @ApiEnvelopeResponse(RECURRING_EXPENSE_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: RecurringListQueryDto,
  ): Promise<Paginated<RecurringExpense>> {
    return this.recurring.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: "Add a recurring payment (a schedule, not a payment)" })
  @ApiEnvelopeResponse(RECURRING_EXPENSE_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateRecurringExpenseDto,
  ): Promise<RecurringExpense> {
    return this.recurring.create(user.id, body);
  }

  @Get("payments")
  @ApiOperation({
    summary: "Due dates: upcoming (overdue, due, scheduled) or history (paid, skipped)",
  })
  @ApiEnvelopeResponse(RECURRING_PAYMENT_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  payments(
    @CurrentUser() user: AuthUser,
    @Query() query: RecurringPaymentsQueryDto,
  ): Promise<Paginated<RecurringPayment>> {
    return this.recurring.payments(user.id, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "One recurring payment schedule" })
  @ApiEnvelopeResponse(RECURRING_EXPENSE_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<RecurringExpense> {
    return this.recurring.get(user.id, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a schedule (a loan's EMI schedule follows the loan)" })
  @ApiEnvelopeResponse(RECURRING_EXPENSE_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateRecurringExpenseDto,
  ): Promise<RecurringExpense> {
    return this.recurring.update(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a schedule (recorded payments stay as expenses)" })
  @ApiErrorResponses(400, 401, 404, 409)
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.recurring.remove(user.id, id);
  }

  @Post(":id/pause")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Pause: nothing falls due until it's resumed" })
  @ApiEnvelopeResponse(RECURRING_EXPENSE_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  pause(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.recurring.setStatus(user.id, id, RecurringStatus.PAUSED);
  }

  @Post(":id/resume")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Resume: due dates count again from today" })
  @ApiEnvelopeResponse(RECURRING_EXPENSE_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  resume(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.recurring.setStatus(user.id, id, RecurringStatus.ACTIVE);
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel for good: no more due dates; recorded payments stay" })
  @ApiEnvelopeResponse(RECURRING_EXPENSE_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  cancel(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.recurring.setStatus(user.id, id, RecurringStatus.CANCELLED);
  }

  @Post(":id/payments/:dueDate/pay")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark a due date paid: records its expense, once" })
  @ApiEnvelopeResponse(RECURRING_PAYMENT_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  pay(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("dueDate", IsoDatePipe) dueDate: string,
    @Body() body: PayRecurringDto,
  ): Promise<RecurringPayment> {
    return this.recurring.pay(user.id, id, dueDate, body);
  }

  @Post(":id/payments/:dueDate/skip")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Skip a due date (nothing is owed for it)" })
  @ApiEnvelopeResponse(RECURRING_PAYMENT_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  skip(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("dueDate", IsoDatePipe) dueDate: string,
  ): Promise<RecurringPayment> {
    return this.recurring.skip(user.id, id, dueDate);
  }

  @Post(":id/payments/:dueDate/postpone")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Postpone a due date to a later day" })
  @ApiEnvelopeResponse(RECURRING_PAYMENT_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  postpone(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("dueDate", IsoDatePipe) dueDate: string,
    @Body() body: PostponeRecurringDto,
  ): Promise<RecurringPayment> {
    return this.recurring.postpone(user.id, id, dueDate, body);
  }

  @Delete(":id/payments/:dueDate")
  @ApiOperation({ summary: "Undo a skip or a postponement (a paid date: delete its expense)" })
  @ApiEnvelopeResponse(RECURRING_PAYMENT_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  reset(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("dueDate", IsoDatePipe) dueDate: string,
  ): Promise<RecurringPayment> {
    return this.recurring.reset(user.id, id, dueDate);
  }
}

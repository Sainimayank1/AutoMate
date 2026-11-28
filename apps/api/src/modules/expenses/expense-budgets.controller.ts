import type { Budget } from "@automate/shared";
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

import { BudgetListQueryDto, CreateBudgetDto, UpdateBudgetDto } from "./dto/recurring.dto";
import { ExpenseBudgetsService } from "./expense-budgets.service";
import { BUDGET_SCHEMA } from "./expenses.constants";

/** Budgets: a monthly or yearly limit per vehicle, overall or for one category. */
@ApiTags("expense-budgets")
@ApiBearerAuth()
@Controller("expense-budgets")
export class ExpenseBudgetsController {
  constructor(private readonly budgets: ExpenseBudgetsService) {}

  @Get()
  @ApiOperation({ summary: "Budgets, each with what's been spent in its current month or year" })
  @ApiEnvelopeResponse(BUDGET_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: BudgetListQueryDto,
  ): Promise<Paginated<Budget>> {
    return this.budgets.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: "Set a budget (one per vehicle and category, or overall)" })
  @ApiEnvelopeResponse(BUDGET_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateBudgetDto): Promise<Budget> {
    return this.budgets.create(user.id, body);
  }

  @Get(":id")
  @ApiOperation({ summary: "One budget" })
  @ApiEnvelopeResponse(BUDGET_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<Budget> {
    return this.budgets.get(user.id, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Change the limit, period or alert (not the vehicle or category)" })
  @ApiEnvelopeResponse(BUDGET_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateBudgetDto,
  ): Promise<Budget> {
    return this.budgets.update(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a budget (no expense changes)" })
  @ApiErrorResponses(400, 401, 404)
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.budgets.remove(user.id, id);
  }
}

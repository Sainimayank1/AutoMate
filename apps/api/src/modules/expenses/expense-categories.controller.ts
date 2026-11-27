import type { ExpenseCategory } from "@automate/shared";
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
  CreateExpenseCategoryDto,
  ExpenseCategoryListQueryDto,
  UpdateExpenseCategoryDto,
} from "./dto/expense.dto";
import { ExpenseCategoriesService } from "./expense-categories.service";
import { EXPENSE_CATEGORY_SCHEMA } from "./expenses.constants";

@ApiTags("expenses")
@ApiBearerAuth()
@Controller("expense-categories")
export class ExpenseCategoriesController {
  constructor(private readonly categories: ExpenseCategoriesService) {}

  @Get()
  @ApiOperation({ summary: "System and custom categories with their subcategories" })
  @ApiEnvelopeResponse(EXPENSE_CATEGORY_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ExpenseCategoryListQueryDto,
  ): Promise<Paginated<ExpenseCategory>> {
    return this.categories.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: "Add a custom category or subcategory" })
  @ApiEnvelopeResponse(EXPENSE_CATEGORY_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    return this.categories.create(user.id, body);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Rename, change the icon, or enable/disable a custom category" })
  @ApiEnvelopeResponse(EXPENSE_CATEGORY_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    return this.categories.update(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an unused custom category (a used one is disabled instead)" })
  @ApiErrorResponses(400, 401, 404, 409)
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(user.id, id);
  }
}

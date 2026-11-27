import type { LoanScheduleRow, VehicleLoan } from "@automate/shared";
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
  CreateVehicleLoanDto,
  LoanRateChangeDto,
  LoanScheduleQueryDto,
  UpdateVehicleLoanDto,
  VehicleLoanListQueryDto,
} from "./dto/recurring.dto";
import { LOAN_SCHEDULE_ROW_SCHEMA, VEHICLE_LOAN_SCHEMA } from "./expenses.constants";
import { VehicleLoansService } from "./vehicle-loans.service";

/** Vehicle loans: terms, the amortisation schedule and floating-rate changes. */
@ApiTags("vehicle-loans")
@ApiBearerAuth()
@Controller("vehicle-loans")
export class VehicleLoansController {
  constructor(private readonly loans: VehicleLoansService) {}

  @Get()
  @ApiOperation({ summary: "The user's vehicle loans with their position today" })
  @ApiEnvelopeResponse(VEHICLE_LOAN_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: VehicleLoanListQueryDto,
  ): Promise<Paginated<VehicleLoan>> {
    return this.loans.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: "Add a loan; its EMIs are scheduled as a recurring payment" })
  @ApiEnvelopeResponse(VEHICLE_LOAN_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateVehicleLoanDto): Promise<VehicleLoan> {
    return this.loans.create(user.id, body);
  }

  @Get(":id")
  @ApiOperation({ summary: "One loan with its position today" })
  @ApiEnvelopeResponse(VEHICLE_LOAN_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<VehicleLoan> {
    return this.loans.get(user.id, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a loan's terms (paid EMIs stay as recorded)" })
  @ApiEnvelopeResponse(VEHICLE_LOAN_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateVehicleLoanDto,
  ): Promise<VehicleLoan> {
    return this.loans.update(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a loan and its EMI schedule (paid EMIs stay as expenses)" })
  @ApiErrorResponses(400, 401, 404, 409)
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.loans.remove(user.id, id);
  }

  @Get(":id/schedule")
  @ApiOperation({ summary: "The amortisation schedule, a page at a time" })
  @ApiEnvelopeResponse(LOAN_SCHEDULE_ROW_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  schedule(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: LoanScheduleQueryDto,
  ): Promise<Paginated<LoanScheduleRow>> {
    return this.loans.schedule(user.id, id, query);
  }

  @Post(":id/rate-changes")
  @ApiOperation({ summary: "Record a floating-rate change from a date" })
  @ApiEnvelopeResponse(VEHICLE_LOAN_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  addRateChange(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: LoanRateChangeDto,
  ): Promise<VehicleLoan> {
    return this.loans.addRateChange(user.id, id, body);
  }

  @Delete(":id/rate-changes/:changeId")
  @ApiOperation({ summary: "Remove a rate change" })
  @ApiEnvelopeResponse(VEHICLE_LOAN_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  removeRateChange(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("changeId", ParseUUIDPipe) changeId: string,
  ): Promise<VehicleLoan> {
    return this.loans.removeRateChange(user.id, id, changeId);
  }
}

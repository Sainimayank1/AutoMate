import type { VehicleTransfer } from "@automate/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import type { ApiResponseSchemaHost } from "@nestjs/swagger";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import type { Paginated } from "@/common/pagination/paginated";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";

import { CreateTransferDto, TransferListQueryDto } from "./dto/transfers.dto";
import { TransfersService } from "./transfers.service";

/** OpenAPI shape of `VehicleTransfer` (@automate/shared). */
const TRANSFER_SCHEMA: ApiResponseSchemaHost["schema"] = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    direction: { type: "string", enum: ["incoming", "outgoing"] },
    vehicleName: { type: "string", example: "Maruti Suzuki Victoris LXI" },
    registrationNumber: { type: "string", example: "HR26EV4821" },
    otherParty: {
      type: "object",
      properties: {
        name: { type: "string", nullable: true },
        email: { type: "string", format: "email" },
      },
    },
    status: {
      type: "string",
      enum: ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED"],
    },
    expiresAt: { type: "string", format: "date-time" },
    decidedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    vehicleId: { type: "string", format: "uuid", nullable: true },
  },
};

/** Moving a vehicle, with all its records, to another AutoMate account. */
@ApiTags("vehicles")
@ApiBearerAuth()
@Controller("vehicle-transfers")
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  @ApiOperation({ summary: "Transfers to you (incoming) or from you (outgoing), newest first" })
  @ApiEnvelopeResponse(TRANSFER_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: TransferListQueryDto,
  ): Promise<Paginated<VehicleTransfer>> {
    return this.transfers.list(user.id, query);
  }

  @Post()
  @ApiOperation({
    summary: "Offer a vehicle to an email address (the same answer whether it has an account)",
  })
  @ApiEnvelopeResponse(TRANSFER_SCHEMA, { status: 201 })
  @ApiErrorResponses(400, 401, 404, 409)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateTransferDto): Promise<VehicleTransfer> {
    return this.transfers.create(user.id, body);
  }

  @Post(":id/accept")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Take the vehicle with all its records and files" })
  @ApiEnvelopeResponse(TRANSFER_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409, 503)
  accept(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<VehicleTransfer> {
    return this.transfers.accept(user.id, id);
  }

  @Post(":id/decline")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Turn a transfer down" })
  @ApiEnvelopeResponse(TRANSFER_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  decline(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<VehicleTransfer> {
    return this.transfers.decline(user.id, id);
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Withdraw a transfer you offered" })
  @ApiEnvelopeResponse(TRANSFER_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<VehicleTransfer> {
    return this.transfers.cancel(user.id, id);
  }
}

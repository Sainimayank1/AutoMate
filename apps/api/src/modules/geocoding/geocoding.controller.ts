import { type ReverseGeocodeResult, reverseGeocodeSchema } from "@automate/shared";
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { createZodDto } from "nestjs-zod";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";

import { GeocodingService } from "./geocoding.service";

class ReverseGeocodeDto extends createZodDto(reverseGeocodeSchema) {}

/** Per IP: a form asks once when it opens (plus retries); this also protects the provider's quota. */
const GEOCODE_RATE_LIMIT = { default: { limit: 20, ttl: 60_000 } };

@ApiTags("geocoding")
@ApiBearerAuth()
@Controller("geocode")
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  /** POST, not GET: request URLs are logged, and coordinates are personal data (bodies never are). */
  @Post("reverse")
  @HttpCode(HttpStatus.OK)
  @Throttle(GEOCODE_RATE_LIMIT)
  @ApiOperation({ summary: "The address at a point (signed-in users only)" })
  @ApiEnvelopeResponse({
    type: "object",
    properties: {
      address: { type: "string", nullable: true, example: "Sector 29, Gurugram, Haryana" },
    },
  })
  @ApiErrorResponses(400, 401)
  async reverse(@Body() body: ReverseGeocodeDto): Promise<ReverseGeocodeResult> {
    return { address: await this.geocoding.reverse(body.latitude, body.longitude) };
  }
}

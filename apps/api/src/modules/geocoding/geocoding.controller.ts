import {
  type PlaceResult,
  placeSearchSchema,
  type ReverseGeocodeResult,
  reverseGeocodeSchema,
} from "@automate/shared";
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
class PlaceSearchDto extends createZodDto(placeSearchSchema) {}

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

  /** POST: place names can be personal (a home address) and request URLs are logged. */
  @Post("search")
  @HttpCode(HttpStatus.OK)
  @Throttle(GEOCODE_RATE_LIMIT)
  @ApiOperation({ summary: "Places matching a search (explicit searches only)" })
  @ApiEnvelopeResponse({
    type: "array",
    items: {
      type: "object",
      properties: {
        label: { type: "string", example: "Gurugram, Haryana" },
        latitude: { type: "number", example: 28.4595 },
        longitude: { type: "number", example: 77.0266 },
      },
    },
  })
  @ApiErrorResponses(400, 401)
  search(@Body() body: PlaceSearchDto): Promise<PlaceResult[]> {
    return this.geocoding.search(body.query);
  }
}

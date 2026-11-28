import { SEARCH_KINDS, type SearchResult } from "@automate/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import type { Paginated } from "@/common/pagination/paginated";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";

import { SearchQueryDto } from "./dto/search.dto";
import { SearchService } from "./search.service";

@ApiTags("search")
@ApiBearerAuth()
@Controller("search")
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({ summary: "Your records containing the text, grouped by kind, newest first" })
  @ApiEnvelopeResponse(
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...SEARCH_KINDS] },
        id: { type: "string", format: "uuid" },
        title: { type: "string", example: "Kherki Daula FASTag" },
        subtitle: { type: "string", nullable: true, example: "₹640.00 · 21 Nov 2026" },
        href: { type: "string", example: "/expenses/transactions/0190…" },
      },
    },
    { paginated: true },
  )
  @ApiErrorResponses(400, 401)
  find(
    @CurrentUser() user: AuthUser,
    @Query() query: SearchQueryDto,
  ): Promise<Paginated<SearchResult>> {
    return this.search.search(user.id, query);
  }
}

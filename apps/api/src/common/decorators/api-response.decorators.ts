import { ErrorCode } from "@automate/shared";
import { applyDecorators, type Type } from "@nestjs/common";
import {
  ApiExtraModels,
  ApiResponse,
  type ApiResponseSchemaHost,
  getSchemaPath,
} from "@nestjs/swagger";

import { DEFAULT_SUCCESS_MESSAGE } from "../constants/http.constants";

/** OpenAPI schema object (not exported from @nestjs/swagger's public entry point). */
type SchemaObject = ApiResponseSchemaHost["schema"];

export const ERROR_RESPONSE_SCHEMA: SchemaObject = {
  type: "object",
  required: ["success", "message", "error"],
  properties: {
    success: { type: "boolean", enum: [false] },
    message: { type: "string", example: "Validation failed" },
    error: {
      type: "object",
      required: ["code", "details", "requestId"],
      properties: {
        code: { type: "string", enum: Object.values(ErrorCode) },
        details: {
          type: "array",
          items: {},
          description: "For VALIDATION_ERROR: [{ field, message }]",
        },
        requestId: { type: "string" },
      },
    },
  },
};

const PAGE_META_SCHEMA: SchemaObject = {
  type: "object",
  required: ["page", "pageSize", "total", "totalPages"],
  properties: {
    page: { type: "integer", example: 1 },
    pageSize: { type: "integer", example: 20 },
    total: { type: "integer", example: 42 },
    totalPages: { type: "integer", example: 3 },
  },
};

/**
 * Documents a success response inside the standard envelope.
 * Pass a DTO class (e.g. from createZodDto) or an inline schema for `data`.
 * `paginated`: `data` is an array of that schema and `meta` is the page meta (list endpoints).
 */
export function ApiEnvelopeResponse(
  data: Type<unknown> | SchemaObject,
  options: { status?: number; description?: string; paginated?: boolean } = {},
) {
  const isModel = typeof data === "function";
  const item = isModel ? { $ref: getSchemaPath(data) } : data;
  return applyDecorators(
    ...(isModel ? [ApiExtraModels(data)] : []),
    ApiResponse({
      status: options.status ?? 200,
      description: options.description,
      schema: {
        type: "object",
        required: ["success", "message", "data", "meta"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: { type: "string", example: DEFAULT_SUCCESS_MESSAGE },
          data: options.paginated ? { type: "array", items: item } : item,
          meta: options.paginated ? PAGE_META_SCHEMA : { type: "object", nullable: true },
        },
      },
    }),
  );
}

/** Documents route-specific error statuses (401, 404, 409...). 429 and 500 are documented globally. */
export function ApiErrorResponses(...statuses: number[]) {
  return applyDecorators(
    ...statuses.map((status) => ApiResponse({ status, schema: ERROR_RESPONSE_SCHEMA })),
  );
}

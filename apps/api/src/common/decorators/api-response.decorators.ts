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

/**
 * Documents a success response inside the standard envelope.
 * Pass a DTO class (e.g. from createZodDto) or an inline schema for `data`.
 */
export function ApiEnvelopeResponse(
  data: Type<unknown> | SchemaObject,
  options: { status?: number; description?: string } = {},
) {
  const isModel = typeof data === "function";
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
          data: isModel ? { $ref: getSchemaPath(data) } : data,
          meta: { type: "object", nullable: true },
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

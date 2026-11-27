import type { ApiResponseSchemaHost } from "@nestjs/swagger";

/** OpenAPI shape of `UserProfile` (@automate/shared). */
export const USER_PROFILE_SCHEMA: ApiResponseSchemaHost["schema"] = {
  type: "object",
  required: ["id", "name", "email", "createdAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string", example: "Arjun Mehta" },
    email: { type: "string", format: "email", example: "arjun.mehta@example.in" },
    createdAt: { type: "string", format: "date-time" },
  },
};

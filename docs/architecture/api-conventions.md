# API conventions

The contract between `apps/api` (producer) and `apps/web` (consumer). The types live in `packages/shared/src/api/response.ts`; import them, don't redeclare them.

## 1. URLs and versioning

- Base: `/{API_PREFIX}/v{n}`, which is `/api/v1` by default. Nest URI versioning, default version `1`.
- Resources are plural nouns in kebab-case: `/api/v1/vehicles`, `/api/v1/vehicles/:vehicleId/fuel-entries`.
- Nest vehicle-owned resources under the vehicle when the vehicle is required context. Use a top-level route with a `?vehicleId=` filter for cross-vehicle views (dashboard, analytics).
- A breaking change to a route ships as `@Version("2")` alongside v1. Remove v1 only after the web stops using it.
- JSON only (`Content-Type: application/json`). Bodies are capped at 100 kB; files never pass through the API (see [backend.md §11](backend.md#11-file-storage-strategy)).
- Field names are `camelCase`. Dates are ISO 8601: `"2026-11-27"` for calendar dates, full UTC timestamps for instants. The web formats them as DD/MM/YYYY.
- Money and decimal quantities are serialised as **strings** (`"1499.50"`) so no precision is lost; the web formats them for display.

## 2. Success responses

Every JSON 2xx response is wrapped by `ResponseEnvelopeInterceptor`. Controllers just return the data.

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": { "id": "..." },
  "meta": null
}
```

- `data` is the resource, an array of resources, or `null`.
- `meta` is `null` today. When pagination arrives with the first list endpoint it will carry `{ page, pageSize, total }`, using one helper so every list behaves the same.
- **Not wrapped:** `204 No Content` (use `@HttpCode(204)` for deletes) and file streams (`StreamableFile`), so downloads and HTTP semantics stay standard.

## 3. Error responses

Every error goes through `AllExceptionsFilter`:

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [{ "field": "odometer", "message": "Too small: expected number to be >0" }],
    "requestId": "6f1c2b0e-..."
  }
}
```

| HTTP | `error.code`          | When                                                                                                                      |
| ---- | --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`    | Body, query or params failed the Zod schema. `details` is `FieldError[]` (`field` is a dot path such as `items.0.amount`) |
| 400  | `BAD_REQUEST`         | Malformed JSON, or another client error with no more specific code                                                        |
| 401  | `UNAUTHORIZED`        | Missing, invalid or expired access token                                                                                  |
| 403  | `FORBIDDEN`           | Authenticated but not allowed                                                                                             |
| 404  | `NOT_FOUND`           | Unknown route, or the resource doesn't exist **or belongs to another user** (never reveal existence)                      |
| 409  | `CONFLICT`            | Unique constraint (e.g. duplicate registration number) or a state conflict                                                |
| 413  | `PAYLOAD_TOO_LARGE`   | Body over the limit                                                                                                       |
| 429  | `RATE_LIMITED`        | Rate limit exceeded                                                                                                       |
| 503  | `SERVICE_UNAVAILABLE` | A required dependency is down (health)                                                                                    |
| 500  | `INTERNAL_ERROR`      | Anything unexpected. The message is always the generic "Internal server error"                                            |

Rules:

- Clients branch on `error.code`, never on `message`.
- 4xx `message` values are written for end users and are safe to display. 5xx bodies never contain internal details; look up `requestId` in the logs.
- `requestId` equals the `x-request-id` response header and appears in every server log line for that request.
- To throw with details, use `throw new ConflictException({ message: "...", details: [...] })`. Use a new `ErrorCode` only for a distinct client-handled case; add it to `packages/shared` first.

## 4. HTTP status codes

| Operation                                       | Success status                    |
| ----------------------------------------------- | --------------------------------- |
| `GET`                                           | 200                               |
| `POST` (create)                                 | 201, returns the created resource |
| `PATCH` (partial update)                        | 200, returns the updated resource |
| `DELETE`                                        | 204, no body                      |
| Action endpoints (`POST /vehicles/:id/archive`) | 200                               |

Use `PATCH` for updates. Avoid `PUT` unless the client really replaces the whole resource.

## 5. Validation

- Define the schema once in `packages/shared` (e.g. `createFuelEntrySchema`), and use it in the web form (zodResolver) and the API DTO: `class CreateFuelEntryDto extends createZodDto(createFuelEntrySchema) {}`.
- The global `ZodValidationPipe` validates any `createZodDto` parameter (`@Body()`, `@Query()`, `@Param()`). Plain types are not validated, so always use a DTO for input.
- Zod's `.strict()` / default stripping decides unknown keys. Prefer the default (unknown keys stripped) for forward compatibility.
- Business rules that need the database (odometer must not go backwards, vehicle belongs to user) live in the service and fail with 400/404/409, not in the schema.

## 6. Authentication

`Authorization: Bearer <accessToken>` on every request except `@Public()` routes (`/health` and `/auth/*`).

- Access tokens come from `POST /auth/register`, `/auth/login` and `/auth/refresh`, as `AuthSession` in the envelope's `data`.
- The refresh token is never in a body. It lives in the httpOnly cookie `automate_rt` (path `/api/v1/auth`), so browser clients must send credentials (`withCredentials: true`).
- On a 401 from any other route, call `POST /auth/refresh` once and retry. If that also returns 401, the user is signed out.
- `POST /auth/register` returns **409 `CONFLICT`** for a taken email, with `details: [{ field: "email", message }]`. Clients read `details` as field errors whenever they have the `FieldError` shape, whatever the code.
- Cookie routes called from an origin outside `FRONTEND_URL` get **403 `FORBIDDEN`**.

Details: [backend.md §6](backend.md#6-authentication).

## 7. Swagger

- UI at `/api/docs` and JSON at `/api/docs/json`. Enabled by default outside production; `SWAGGER_ENABLED=true` turns it on in production (put it behind auth first).
- Per controller: `@ApiTags("<module>")`, plus `@ApiBearerAuth()` unless it's public.
- Per route: `@ApiOperation({ summary })`, `@ApiEnvelopeResponse(Dto | schema, { status, description })` for the success shape, and `@ApiErrorResponses(401, 404, ...)` for route-specific errors. 429 and 500 are documented globally.
- `createZodDto` classes produce their OpenAPI schema automatically (via `cleanupOpenApiDoc`), so don't hand-write `@ApiProperty` for Zod DTOs.

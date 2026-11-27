import { HttpStatus, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { cleanupOpenApiDoc } from "nestjs-zod";

import { JSON_BODY_LIMIT, REQUEST_ID_HEADER } from "./common/constants/http.constants";
import { ERROR_RESPONSE_SCHEMA } from "./common/decorators/api-response.decorators";
import { requestIdMiddleware } from "./common/middleware/request-id.middleware";
import type { Env } from "./config/env.validation";

/**
 * HTTP-level setup shared by main.ts and the e2e tests, so tests exercise the real pipeline.
 * The app must be created with `{ bodyParser: false, bufferLogs: true }`.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const prefix = config.get("API_PREFIX", { infer: true });
  const version = config.get("API_VERSION", { infer: true });
  const origins = config.get("FRONTEND_URL", { infer: true });

  app.useLogger(app.get(Logger));
  app.use(requestIdMiddleware);
  app.set("trust proxy", config.get("TRUST_PROXY", { infer: true }));
  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser("json", { limit: JSON_BODY_LIMIT });
  app.enableCors({
    // "*" is rejected in production by env validation.
    origin: origins.includes("*") ? true : origins,
    credentials: true,
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  app.setGlobalPrefix(prefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: version.slice(1) });
  app.enableShutdownHooks();

  if (config.get("SWAGGER_ENABLED", { infer: true })) {
    setupSwagger(app, `${prefix}/docs`, version);
  }
}

function setupSwagger(app: NestExpressApplication, path: string, version: string): void {
  const builder = new DocumentBuilder()
    .setTitle("AutoMate API")
    .setDescription(
      "REST API for AutoMate, the car ownership assistant. Every JSON response uses the " +
        "standard envelope: `{ success, message, data, meta }` or `{ success, message, error }`.",
    )
    .setVersion(version)
    .addBearerAuth();
  for (const status of [HttpStatus.TOO_MANY_REQUESTS, HttpStatus.INTERNAL_SERVER_ERROR]) {
    builder.addGlobalResponse({ status, schema: ERROR_RESPONSE_SCHEMA });
  }
  const document = SwaggerModule.createDocument(app, builder.build());
  SwaggerModule.setup(path, app, cleanupOpenApiDoc(document), { jsonDocumentUrl: `${path}/json` });
}

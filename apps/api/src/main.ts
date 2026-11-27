import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";

import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import type { Env } from "./config/env.validation";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false, // configured with an explicit size limit in configureApp
  });
  configureApp(app);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get("PORT", { infer: true });
  await app.listen(port);

  const base = `http://localhost:${port}/${config.get("API_PREFIX", { infer: true })}`;
  const docs = config.get("SWAGGER_ENABLED", { infer: true }) ? `, docs at ${base}/docs` : "";
  app
    .get(Logger)
    .log(`API listening on ${base}/${config.get("API_VERSION", { infer: true })}${docs}`);
}

void bootstrap();

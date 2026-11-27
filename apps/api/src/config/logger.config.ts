import type { Params } from "nestjs-pino";

import type { Env } from "./env.validation";

/** Never logged: credentials, tokens, cookies. Request/response bodies are not logged at all. */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "*.password",
  "*.currentPassword",
  "*.newPassword",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.secret",
];

export function loggerConfig(env: Pick<Env, "NODE_ENV" | "LOG_LEVEL">): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                singleLine: true,
                translateTime: "SYS:HH:MM:ss.l",
                ignore: "pid,hostname",
              },
            }
          : undefined,
      // No genReqId: pino-http reuses req.id set by requestIdMiddleware.
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
      // Platform health probes hit this every few seconds; failures are still logged by Terminus.
      autoLogging: { ignore: (req) => req.url?.endsWith("/health") ?? false },
    },
  };
}

import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  type HealthCheckResult,
  HealthCheckService,
  type HealthIndicatorFunction,
  PrismaHealthIndicator,
} from "@nestjs/terminus";

import type { Env } from "@/config/env.validation";
import { PrismaService } from "@/database/prisma.service";

import { RedisHealthIndicator } from "./redis.health";

export interface HealthReport {
  status: HealthCheckResult["status"];
  checks: Record<string, string>;
  app: { name: string; environment: string; apiVersion: string; uptimeSeconds: number };
}

/** Generous enough for a serverless Postgres (Neon) waking from idle. */
const DATABASE_PING_TIMEOUT_MS = 3_000;

@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Resolves when every required dependency is up; otherwise throws 503 with per-check status. */
  async check(): Promise<HealthReport> {
    const checks: HealthIndicatorFunction[] = [
      () =>
        this.prismaHealth.pingCheck("database", this.prisma, {
          timeout: DATABASE_PING_TIMEOUT_MS,
        }),
    ];
    if (this.config.get("REDIS_ENABLED", { infer: true })) {
      checks.push(() => this.redisHealth.isHealthy("redis"));
    }

    try {
      return this.toReport(await this.health.check(checks));
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      // Report only up/down per dependency; indicator messages can contain hosts or driver errors.
      throw new ServiceUnavailableException({
        message: "A required dependency is unavailable",
        details: [this.toReport(error.getResponse() as HealthCheckResult)],
      });
    }
  }

  private toReport(result: HealthCheckResult): HealthReport {
    return {
      status: result.status,
      checks: Object.fromEntries(
        Object.entries(result.details).map(([name, detail]) => [name, String(detail.status)]),
      ),
      app: {
        name: "automate-api",
        environment: this.config.get("NODE_ENV", { infer: true }),
        apiVersion: this.config.get("API_VERSION", { infer: true }),
        uptimeSeconds: Math.floor(process.uptime()),
      },
    };
  }
}

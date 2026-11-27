import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";
import { Redis } from "ioredis";

import type { Env } from "@/config/env.validation";

/** Pings Redis when REDIS_ENABLED=true. No client (and no connection) exists otherwise. */
@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private readonly client: Redis | null;

  constructor(
    config: ConfigService<Env, true>,
    private readonly indicator: HealthIndicatorService,
  ) {
    this.client = config.get("REDIS_ENABLED", { infer: true })
      ? new Redis({
          host: config.get("REDIS_HOST", { infer: true }),
          port: config.get("REDIS_PORT", { infer: true }),
          connectTimeout: 2_000,
          maxRetriesPerRequest: 1,
          // Fail pings fast while disconnected instead of queueing them; reconnects continue.
          enableOfflineQueue: false,
        })
      : null;
    // Connection errors are reported through /health rather than as unhandled events.
    this.client?.on("error", () => undefined);
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const check = this.indicator.check(key);
    try {
      await this.client?.ping();
      return check.up();
    } catch {
      return check.down();
    }
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
  }
}

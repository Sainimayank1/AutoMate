import type { RouteOption, RoutePoint, RouteResult } from "@automate/shared";
import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "@/config/env.validation";

/** OSRM's `/route` response: only what we read. */
export type OsrmResponse = {
  code?: string;
  routes?: { distance?: number; duration?: number; geometry?: string }[];
};

const PROVIDER = "OpenStreetMap (OSRM)";
const TIMEOUT_MS = 8000;
const ROUTES_MAX = 3;
export const ROUTE_UNAVAILABLE =
  "Couldn't calculate a route right now. Enter the distance or use odometer readings instead.";

/** The provider's routes as km, minutes and the encoded line; nothing invented. */
export function toRouteOptions(body: OsrmResponse): RouteOption[] {
  if (body.code !== "Ok") return [];
  return (body.routes ?? [])
    .filter((route) => route.distance && route.duration !== undefined && route.geometry)
    .slice(0, ROUTES_MAX)
    .map((route) => ({
      distanceKm: (route.distance! / 1000).toFixed(1),
      durationMinutes: Math.round(route.duration! / 60),
      geometry: route.geometry!,
    }));
}

/**
 * Driving routes through the configured OSRM-compatible server (`ROUTER_URL`), called from the
 * API only. Points are personal data and never logged. No route → 503, so a trip is never saved
 * with an invented distance.
 */
@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async route(points: RoutePoint[]): Promise<RouteResult> {
    const coordinates = points.map((point) => `${point.longitude},${point.latitude}`).join(";");
    const url = new URL(
      `${this.config.get("ROUTER_URL", { infer: true }).replace(/\/$/, "")}/route/v1/driving/${coordinates}`,
    );
    url.search = new URLSearchParams({
      overview: "full",
      geometries: "polyline6",
      alternatives: points.length === 2 ? "true" : "false",
    }).toString();
    let routes: RouteOption[] = [];
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok) routes = toRouteOptions((await response.json()) as OsrmResponse);
      else this.logger.warn(`Routing failed with HTTP ${response.status}`);
    } catch (error) {
      this.logger.warn(`Routing failed: ${(error as Error).name}`);
    }
    if (!routes.length) throw new ServiceUnavailableException(ROUTE_UNAVAILABLE);
    return { provider: PROVIDER, routes };
  }
}

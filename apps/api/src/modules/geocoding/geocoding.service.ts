import type { PlaceResult } from "@automate/shared";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "@/config/env.validation";

/** Nominatim's (and compatible providers') `/reverse` response: only what we read. */
export type ReverseResponse = {
  name?: string;
  display_name?: string;
  address?: Partial<Record<string, string>>;
};

const MAX_ADDRESS = 200;
const TIMEOUT_MS = 5000;
/** Nominatim's usage policy asks every client to identify itself. */
const USER_AGENT = "AutoMate/0.1 (vehicle ownership app)";

/** "IndianOil COCO, Sector 29 Road, Sector 29, Gurugram, Haryana": place, road, area, city, state. */
export function toShortAddress(body: ReverseResponse): string | null {
  const a = body.address ?? {};
  const parts = [
    body.name,
    a.road,
    a.neighbourhood ?? a.suburb ?? a.quarter,
    a.city ?? a.town ?? a.village ?? a.county ?? a.state_district,
    a.state,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part);
  const address = [...new Set(parts)].join(", ") || body.display_name?.trim() || null;
  return address?.slice(0, MAX_ADDRESS) ?? null;
}

/** Nominatim's `/search` result: only what we read. */
export type SearchResponse = ReverseResponse & { lat?: string; lon?: string };

/** Place results with usable coordinates, labelled like reverse geocoding. */
export function toPlaces(body: SearchResponse[]): PlaceResult[] {
  return body.flatMap((item) => {
    const latitude = Number(item.lat);
    const longitude = Number(item.lon);
    const label = toShortAddress(item);
    return label && Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [{ label, latitude, longitude }]
      : [];
  });
}

/**
 * Coordinates → a short address, through a configurable Nominatim-compatible provider.
 * Never throws: without an address the fill-up still keeps its coordinates. Coordinates are
 * personal data, so they're never logged.
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async reverse(latitude: number, longitude: number): Promise<string | null> {
    const url = new URL(this.config.get("GEOCODER_URL", { infer: true }));
    url.search = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: "json",
      zoom: "18",
      addressdetails: "1",
      "accept-language": "en",
    }).toString();
    const key = this.config.get("GEOCODER_API_KEY", { infer: true });
    if (key) url.searchParams.set("key", key);

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(`Reverse geocoding failed with HTTP ${response.status}`);
        return null;
      }
      return toShortAddress((await response.json()) as ReverseResponse);
    } catch (error) {
      this.logger.warn(`Reverse geocoding failed: ${(error as Error).name}`);
      return null;
    }
  }

  /**
   * Places matching what the user typed (the provider's `/search`, beside the configured
   * `/reverse`), in India first. Explicit searches only: Nominatim's policy forbids
   * search-as-you-type. Never throws; place names are personal data and never logged.
   */
  async search(query: string): Promise<PlaceResult[]> {
    const url = new URL(
      this.config.get("GEOCODER_URL", { infer: true }).replace(/\/reverse\/?$/, "/search"),
    );
    url.search = new URLSearchParams({
      q: query,
      format: "json",
      limit: "5",
      addressdetails: "1",
      countrycodes: "in",
      "accept-language": "en",
    }).toString();
    const key = this.config.get("GEOCODER_API_KEY", { infer: true });
    if (key) url.searchParams.set("key", key);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(`Place search failed with HTTP ${response.status}`);
        return [];
      }
      return toPlaces((await response.json()) as SearchResponse[]);
    } catch (error) {
      this.logger.warn(`Place search failed: ${(error as Error).name}`);
      return [];
    }
  }
}

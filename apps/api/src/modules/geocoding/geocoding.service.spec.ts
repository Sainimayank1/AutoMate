import type { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Env } from "@/config/env.validation";

import { GeocodingService, toShortAddress } from "./geocoding.service";

describe("toShortAddress", () => {
  it("keeps place, road, area, city and state, without repeats", () => {
    expect(
      toShortAddress({
        name: "IndianOil COCO",
        address: {
          road: "Sector 29 Road",
          suburb: "Sector 29",
          city: "Gurugram",
          state_district: "Gurugram",
          state: "Haryana",
          postcode: "122001",
          country: "India",
        },
      }),
    ).toBe("IndianOil COCO, Sector 29 Road, Sector 29, Gurugram, Haryana");
    expect(
      toShortAddress({ name: "Gurugram", address: { city: "Gurugram", state: "Haryana" } }),
    ).toBe("Gurugram, Haryana");
  });

  it("falls back to the full name, and has nothing for the open sea", () => {
    expect(toShortAddress({ display_name: "Somewhere, India" })).toBe("Somewhere, India");
    expect(toShortAddress({})).toBeNull();
  });
});

describe("GeocodingService", () => {
  const config = (values: Partial<Env>) =>
    ({ get: (key: keyof Env) => values[key] }) as unknown as ConfigService<Env, true>;
  const service = new GeocodingService(
    config({ GEOCODER_URL: "https://geo.example.test/reverse", GEOCODER_API_KEY: "k1" }),
  );

  afterEach(() => vi.unstubAllGlobals());

  it("asks the provider with the key and an identifying user agent", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ address: { city: "Gurugram", state: "Haryana" } })),
      );
    vi.stubGlobal("fetch", fetch);

    await expect(service.reverse(28.4595, 77.0726)).resolves.toBe("Gurugram, Haryana");
    const [url, init] = fetch.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("lat")).toBe("28.4595");
    expect(url.searchParams.get("lon")).toBe("77.0726");
    expect(url.searchParams.get("key")).toBe("k1");
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/^AutoMate/);
  });

  it("returns null instead of failing when the provider is down or refuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(service.reverse(28.4595, 77.0726)).resolves.toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));
    await expect(service.reverse(28.4595, 77.0726)).resolves.toBeNull();
  });
});

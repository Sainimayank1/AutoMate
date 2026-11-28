import { decodePolyline } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { toPlaces } from "./geocoding.service";
import { toRouteOptions } from "./routing.service";

describe("routing and place search", () => {
  it("keeps the provider's routes as km, minutes and line, up to three", () => {
    const route = (distance: number, duration: number) => ({
      distance,
      duration,
      geometry: "_p~iF~ps|U",
    });
    expect(
      toRouteOptions({
        code: "Ok",
        routes: [route(268_420, 15_120), route(281_000, 16_200), route(1, 1), route(2, 2)],
      }),
    ).toEqual([
      { distanceKm: "268.4", durationMinutes: 252, geometry: "_p~iF~ps|U" },
      { distanceKm: "281.0", durationMinutes: 270, geometry: "_p~iF~ps|U" },
      { distanceKm: "0.0", durationMinutes: 0, geometry: "_p~iF~ps|U" },
    ]);
    expect(toRouteOptions({ code: "NoRoute", routes: [route(1, 1)] })).toEqual([]);
    expect(
      toRouteOptions({ code: "Ok", routes: [{ distance: 0, duration: 0, geometry: "x" }] }),
    ).toEqual([]);
  });

  it("keeps places with coordinates, labelled short", () => {
    expect(
      toPlaces([
        { lat: "28.4595", lon: "77.0266", name: "Gurugram", address: { state: "Haryana" } },
        { lat: "x", lon: "77", name: "Broken" },
      ]),
    ).toEqual([{ label: "Gurugram, Haryana", latitude: 28.4595, longitude: 77.0266 }]);
  });

  it("decodes an encoded polyline (precision 5 and 6)", () => {
    // Google's documented example.
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@", 5)).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
    expect(decodePolyline("")).toEqual([]);
  });
});

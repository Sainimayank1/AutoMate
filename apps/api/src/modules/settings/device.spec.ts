import { describe, expect, it } from "vitest";

import { deviceName } from "./device";

describe("deviceName", () => {
  it("names the browser and the system", () => {
    expect(
      deviceName(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
      ),
    ).toBe("Chrome on Windows");
    expect(
      deviceName(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari on iPhone");
    expect(
      deviceName("Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0"),
    ).toBe("Firefox on Linux");
    expect(
      deviceName(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0",
      ),
    ).toBe("Edge on Windows");
  });

  it("says so when it can't tell", () => {
    expect(deviceName(null)).toBe("Unknown device");
    expect(deviceName("curl/8.5.0")).toBe("Unknown device");
  });
});

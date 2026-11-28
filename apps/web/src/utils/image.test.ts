import { describe, expect, it } from "vitest";

import { shrinkImage } from "@/utils/image";

describe("shrinkImage", () => {
  it("leaves PDFs, HEIC and small photos alone", async () => {
    const pdf = new File([new Uint8Array(3 * 1024 * 1024)], "invoice.pdf", {
      type: "application/pdf",
    });
    const heic = new File([new Uint8Array(3 * 1024 * 1024)], "receipt.heic", {
      type: "image/heic",
    });
    const small = new File([new Uint8Array(1024)], "receipt.jpg", { type: "image/jpeg" });
    for (const file of [pdf, heic, small]) expect(await shrinkImage(file)).toBe(file);
  });

  it("uploads the original when the browser can't redraw it", async () => {
    // jsdom has no createImageBitmap: a big photo goes unchanged rather than failing.
    const big = new File([new Uint8Array(3 * 1024 * 1024)], "receipt.jpg", { type: "image/jpeg" });
    expect(await shrinkImage(big)).toBe(big);
  });
});

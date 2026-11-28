import { describe, expect, it } from "vitest";

import { sniffType } from "./file-signature";

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part,
    ),
  );

describe("sniffType", () => {
  it("knows the five document types by their first bytes", () => {
    expect(sniffType(bytes("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffType(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffType(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toBe("image/webp");
    expect(sniffType(bytes([0, 0, 0, 0x18], "ftypheic"))).toBe("image/heic");
  });

  it("refuses anything else", () => {
    expect(sniffType(bytes("MZ", [0x90, 0]))).toBeNull();
    expect(sniffType(bytes("<html>"))).toBeNull();
    expect(sniffType(new Uint8Array())).toBeNull();
  });
});

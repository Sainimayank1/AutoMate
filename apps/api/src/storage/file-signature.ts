import type { DocumentFileType } from "@automate/shared";

const ascii = (bytes: Uint8Array, from: number, length: number) =>
  String.fromCharCode(...bytes.subarray(from, from + length));

/**
 * The real type of a file from its first bytes, for the five document types only (PDF, JPEG, PNG,
 * WebP, HEIC); null for anything else. Enough to refuse a renamed file; the browser's own type
 * is never trusted.
 */
export function sniffType(bytes: Uint8Array): DocumentFileType | null {
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(bytes, 1, 3) === "PNG" && bytes[0] === 0x89) return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (
    ascii(bytes, 4, 4) === "ftyp" &&
    /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(ascii(bytes, 8, 4))
  ) {
    return "image/heic";
  }
  return null;
}

/** Bytes `sniffType` needs. */
export const SIGNATURE_BYTES = 16;

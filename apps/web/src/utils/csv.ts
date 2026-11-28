type CsvValue = string | number | null | undefined;

/**
 * One CSV cell: quoted when it holds a comma, quote or line break (RFC 4180). Text that a
 * spreadsheet would run as a formula (=, +, -, @, tab, CR) gets a leading ' ; numbers stay numbers.
 */
function cell(value: CsvValue) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows (the header first) as CSV text. */
export const toCsv = (rows: CsvValue[][]) =>
  rows.map((row) => row.map(cell).join(",")).join("\r\n");

/** Saves text as a file through the browser (no upload, nothing leaves the device). */
export function downloadFile(filename: string, parts: BlobPart[], type: string) {
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  // Some browsers (Safari) start the download after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// BOM so Excel reads ₹ and other UTF-8 text correctly.
export const downloadCsv = (filename: string, csv: string) =>
  downloadFile(filename, ["﻿", csv], "text/csv;charset=utf-8");

/**
 * CSV with spreadsheet-formula injection protection: customer-controlled text such as a name of "=HYPERLINK(...)" would
 * otherwise execute when the owner opens the export in Excel/Sheets. Cells that start with = + - @ tab or CR get a leading apostrophe.
 */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
export const toCsv = (header: string[], rows: unknown[][]) => '\uFEFF' + [header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');

import * as XLSX from "xlsx";

export interface RawRow {
  rowNumber: number; // 對應 Excel 實際列號（含標題列，所以資料從第 2 列開始）
  cells: Record<string, unknown>;
}

export interface RawSheet {
  headers: string[];
  rows: RawRow[];
}

export async function readWorkbookFile(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { cellDates: true });
}

export function extractRawSheet(wb: XLSX.WorkBook, sheetName: string): RawSheet | null {
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
  if (aoa.length === 0) return { headers: [], rows: [] };

  const headers = (aoa[0] ?? []).map((h) => String(h ?? "").trim());
  const rows: RawRow[] = [];

  for (let i = 1; i < aoa.length; i++) {
    const rawRow = aoa[i] ?? [];
    // 跳過整列都是空白的列（常見於使用者留白的範本列）
    const isBlank = rawRow.every((v) => v === "" || v === null || v === undefined);
    if (isBlank) continue;

    const cells: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      if (h) cells[h] = rawRow[idx];
    });
    rows.push({ rowNumber: i + 1, cells });
  }

  return { headers, rows };
}

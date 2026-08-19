// Excel 儲存日期／時間的方式很多種：
// 1. 儲存格格式設成「日期」/「時間」的真正日期時間值（SheetJS 讀檔時用 cellDates:true 會自動轉成 JS Date）
// 2. 儲存格是數字但格式沒設對，本質仍是「Excel 日期序號」（1900 年制，例如 46316 代表 2026-10-19）
// 3. 儲存格是純文字，例如 "2026-10-19"、"2026/10/19"、"09:00"
// 這裡統一把以上三種都轉成標準格式：日期 YYYY-MM-DD、時間 HH:mm。
// 無法辨識的一律回傳 ok:false，交由呼叫端列為「錯誤」，不自行猜測。

export interface ParseResult<T> {
  ok: boolean;
  value: T | null;
  raw: unknown;
}

const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30); // Excel 1900 日期系統的第 0 天

function excelSerialToUtcMs(serial: number): number {
  return EXCEL_EPOCH_UTC_MS + serial * 86400000;
}

export function parseDateCell(value: unknown): ParseResult<string> {
  if (value === null || value === undefined || value === "") {
    return { ok: false, value: null, raw: value };
  }

  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return { ok: true, value: `${y}-${m}-${d}`, raw: value };
  }

  if (typeof value === "number" && isFinite(value) && value > 0) {
    // 合理的日期序號範圍（大約 2000-01-01 ~ 2100-01-01），避免把普通數字誤判成日期
    if (value >= 36526 && value <= 73050) {
      const ms = excelSerialToUtcMs(Math.floor(value));
      const dt = new Date(ms);
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      return { ok: true, value: `${y}-${m}-${d}`, raw: value };
    }
    return { ok: false, value: null, raw: value };
  }

  if (typeof value === "string") {
    const s = value.trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return {
          ok: true,
          value: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
          raw: value,
        };
      }
    }
    return { ok: false, value: null, raw: value };
  }

  return { ok: false, value: null, raw: value };
}

export function parseTimeCell(value: unknown): ParseResult<string> {
  if (value === null || value === undefined || value === "") {
    return { ok: false, value: null, raw: value };
  }

  if (value instanceof Date && !isNaN(value.getTime())) {
    const h = String(value.getUTCHours()).padStart(2, "0");
    const mi = String(value.getUTCMinutes()).padStart(2, "0");
    return { ok: true, value: `${h}:${mi}`, raw: value };
  }

  if (typeof value === "number" && isFinite(value) && value >= 0) {
    // 純小數 (0~1之間) 代表一天中的比例；若是「日期序號.時間小數」的組合，取小數部分
    const frac = value - Math.floor(value);
    const totalSeconds = Math.round(frac * 86400);
    const h = Math.floor(totalSeconds / 3600) % 24;
    const mi = Math.floor((totalSeconds % 3600) / 60);
    return { ok: true, value: `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`, raw: value };
  }

  if (typeof value === "string") {
    const s = value.trim();
    const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      const h = Number(m[1]);
      const mi = Number(m[2]);
      if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) {
        return { ok: true, value: `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`, raw: value };
      }
    }
    return { ok: false, value: null, raw: value };
  }

  return { ok: false, value: null, raw: value };
}

export function parseBooleanCell(value: unknown, defaultValue = true): boolean {
  if (value === null || value === undefined || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["是", "true", "yes", "y", "1", "啟用", "可用"].includes(s)) return true;
  if (["否", "false", "no", "n", "0", "停用", "不可用"].includes(s)) return false;
  return defaultValue;
}

export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function cellToNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return isFinite(n) ? n : null;
}

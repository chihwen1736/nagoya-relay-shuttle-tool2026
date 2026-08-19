// 「已過結單時間」的判斷一律以日本時間（Asia/Tokyo）為準，
// 用 Intl.DateTimeFormat 指定 timeZone，這樣不管使用者電腦本身設定在哪個時區，
// 算出來的「現在是日本幾點」都是正確的，不依賴使用者電腦的系統時區設定。

const TZ = "Asia/Tokyo";

export function getTokyoNow(): { date: string; time: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = get("hour") === "24" ? "00" : get("hour");
  const time = `${hour}:${get("minute")}:${get("second")}`;
  return { date, time };
}

export function timeToSeconds(t: string): number {
  const parts = t.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  return h * 3600 + m * 60 + s;
}

export function addMinutesToTime(t: string, minutes: number): string {
  const totalSeconds = timeToSeconds(t) + minutes * 60;
  const wrapped = ((totalSeconds % 86400) + 86400) % 86400;
  const h = Math.floor(wrapped / 3600).toString().padStart(2, "0");
  const m = Math.floor((wrapped % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(wrapped % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = timeToSeconds(aStart);
  const ae = timeToSeconds(aEnd);
  const bs = timeToSeconds(bStart);
  const be = timeToSeconds(bEnd);
  return as < be && bs < ae;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = (dt.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = dt.getUTCDate().toString().padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
  return dateStr >= startStr && dateStr <= endStr;
}

/**
 * 純顯示用：這個服務日期是否已經過了「服務日前一日 cutoffTime（日本時間）」。
 * 這個系統不會用這個結果去鎖定/擋下任何操作，只用來在畫面上顯示提醒標籤。
 */
export function isPastCutoff(reservationDate: string, cutoffTime: string): boolean {
  const { date: todayStr, time: nowTime } = getTokyoNow();
  const cutoffDate = addDays(reservationDate, -1);
  if (todayStr > cutoffDate) return true;
  if (todayStr < cutoffDate) return false;
  return timeToSeconds(nowTime) >= timeToSeconds(cutoffTime);
}

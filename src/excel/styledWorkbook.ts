import ExcelJS from "exceljs";
import {
  SHEET_NAMES,
  SETTINGS_HEADERS,
  TEAM_HEADERS,
  LOCATION_HEADERS,
  VEHICLE_HEADERS,
  VEHICLE_AVAILABILITY_HEADERS,
  RESERVATION_HEADERS,
  SHUTTLE_TRIP_HEADERS,
} from "./schema";

// 這個檔案是「空白範本」與「範例資料」兩份 Excel 的唯一產生來源。
// 系統裡「下載空白範本」「下載範例資料」按鈕，跟我們直接附加給您下載的兩份 .xlsx，
// 都是呼叫這裡的同一組函式產生，兩邊保證欄位、格式、驗證規則完全一致。

const YELLOW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFF2CC" },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2F5FDC" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };

const YES_NO = ["是", "否"];
const LOCATION_TYPES = ["中繼站", "住宿地點", "比賽場館", "其他"];
const SERVICE_TYPES = ["派車", "餐食", "治療防護", "運動科學"];
const TRIP_TYPES = ["單程", "來回"];
const RESERVATION_STATUSES = ["待確認", "已確認", "已取消"];
const LEG_TYPES = ["單程", "去程", "回程"];
const TRIP_STATUSES = ["草稿", "已確認"];
const ASSIGNMENT_STATUSES = ["已指派", "未指派", "有衝突"];
const TRIP_ORIGINS = ["系統自動產生", "管理者人工調整", "管理者人工新增"];

const DATA_ROWS = 300; // 資料驗證下拉選單／格式套用的列數範圍，方便使用者之後自行增列時仍在範圍內

interface SheetSpec {
  name: string;
  headers: readonly string[];
  requiredColumns: string[]; // 必填欄位標示淺黃色
  columnFormats?: Record<string, "date" | "time" | "text">;
  dropdowns?: Record<string, string[]>;
  columnComments?: Record<string, string>;
  columnWidths?: number[];
}

function addSheet(wb: ExcelJS.Workbook, spec: SheetSpec) {
  const ws = wb.addWorksheet(spec.name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = spec.headers.map((h, idx) => ({
    header: h,
    key: h,
    width: spec.columnWidths?.[idx] ?? Math.max(12, h.length * 2.2),
  }));

  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // 開啟自動篩選（涵蓋標題列 + 資料範圍）
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: spec.headers.length },
  };

  // 必填欄位淺黃色（套用到資料列範圍，讓使用者一眼看出要填哪些欄）
  for (const col of spec.requiredColumns) {
    const colIdx = spec.headers.indexOf(col as (typeof spec.headers)[number]) + 1;
    if (colIdx === 0) continue;
    for (let r = 2; r <= DATA_ROWS; r++) {
      ws.getCell(r, colIdx).fill = YELLOW_FILL;
    }
  }

  // 欄位格式（日期/時間/文字）。同時設定「欄」層級與逐一儲存格層級，
  // 確保無論用 Excel 或其他工具開啟，格式都能正確套用（只設欄層級在部分情境下不會反映到每個儲存格）。
  if (spec.columnFormats) {
    for (const [col, fmt] of Object.entries(spec.columnFormats)) {
      const colIdx = spec.headers.indexOf(col as (typeof spec.headers)[number]) + 1;
      if (colIdx === 0) continue;
      const numFmt = fmt === "date" ? "yyyy-mm-dd" : fmt === "time" ? "hh:mm" : "@";
      ws.getColumn(colIdx).numFmt = numFmt;
      for (let r = 2; r <= DATA_ROWS; r++) {
        ws.getCell(r, colIdx).numFmt = numFmt;
      }
    }
  }

  // 下拉選單
  if (spec.dropdowns) {
    for (const [col, options] of Object.entries(spec.dropdowns)) {
      const colIdx = spec.headers.indexOf(col as (typeof spec.headers)[number]) + 1;
      if (colIdx === 0) continue;
      for (let r = 2; r <= DATA_ROWS; r++) {
        ws.getCell(r, colIdx).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${options.join(",")}"`],
        };
      }
    }
  }

  // 欄位說明（Excel 註解），用於「條件式必填」的欄位提醒
  if (spec.columnComments) {
    for (const [col, comment] of Object.entries(spec.columnComments)) {
      const colIdx = spec.headers.indexOf(col as (typeof spec.headers)[number]) + 1;
      if (colIdx === 0) continue;
      ws.getCell(1, colIdx).note = comment;
    }
  }

  return ws;
}

function buildCommonSheets(wb: ExcelJS.Workbook) {
  addSheet(wb, {
    name: SHEET_NAMES.teams,
    headers: TEAM_HEADERS,
    requiredColumns: ["隊伍代碼", "隊伍名稱"],
    columnFormats: { 隊伍代碼: "text" },
    dropdowns: { 啟用: YES_NO },
  });

  addSheet(wb, {
    name: SHEET_NAMES.locations,
    headers: LOCATION_HEADERS,
    requiredColumns: ["地點代碼", "地點名稱", "地點類型"],
    columnFormats: { 地點代碼: "text" },
    dropdowns: { 地點類型: LOCATION_TYPES, 啟用: YES_NO },
  });

  addSheet(wb, {
    name: SHEET_NAMES.vehicles,
    headers: VEHICLE_HEADERS,
    requiredColumns: ["車輛代碼", "座位數"],
    columnFormats: { 車輛代碼: "text" },
    dropdowns: { 啟用: YES_NO },
  });

  addSheet(wb, {
    name: SHEET_NAMES.vehicleAvailability,
    headers: VEHICLE_AVAILABILITY_HEADERS,
    requiredColumns: ["車輛代碼", "日期", "開始時間", "結束時間"],
    columnFormats: { 車輛代碼: "text", 日期: "date", 開始時間: "time", 結束時間: "time" },
    dropdowns: { 是否可用: YES_NO },
  });

  addSheet(wb, {
    name: SHEET_NAMES.reservations,
    headers: RESERVATION_HEADERS,
    requiredColumns: ["預約單編號", "隊伍代碼", "預約日期", "服務項目", "開始時間", "結束時間", "人數", "聯絡人"],
    columnFormats: {
      預約單編號: "text",
      隊伍代碼: "text",
      預約日期: "date",
      開始時間: "time",
      結束時間: "time",
      上車地點代碼: "text",
      下車地點代碼: "text",
      回程時間: "time",
    },
    dropdowns: { 服務項目: SERVICE_TYPES, 單程或來回: TRIP_TYPES, 狀態: RESERVATION_STATUSES },
    columnComments: {
      上車地點代碼: "服務項目為「派車」時必填；「治療防護」「運動科學」可借用此欄位填服務地點代碼",
      下車地點代碼: "服務項目為「派車」時必填",
      單程或來回: "服務項目為「派車」時必填",
      回程時間: "單程或來回為「來回」時必填",
      狀態: "留白視為「待確認」",
    },
  });

  addSheet(wb, {
    name: SHEET_NAMES.shuttleTrips,
    headers: SHUTTLE_TRIP_HEADERS,
    requiredColumns: [],
    columnFormats: { 車輛代碼: "text", 日期: "date", 出發時間: "time", 上車地點代碼: "text", 下車地點代碼: "text", 預約單編號: "text", 隊伍代碼: "text" },
    dropdowns: { 行程方向: LEG_TYPES, 行程狀態: TRIP_STATUSES, 指派結果: ASSIGNMENT_STATUSES, 產生方式: TRIP_ORIGINS },
    columnComments: { 車輛代碼: "留空代表尚未指派車輛" },
  });
}

/**
 * 直接寫入指定列號的資料（而不是用 addRow 依 rowCount 自動接在最後一列）。
 * 因為 addSheet() 已經先把必填欄位淺黃色／欄位格式／下拉選單套用到第 2～300 列，
 * 這會讓 worksheet 的 rowCount 提前變成 300，這時如果用 addRow() 寫範例資料，
 * 會被誤判「接在第 300 列後面」變成寫到第 301 列，而不是我們想要的第 2 列開始。
 * 用 getRow(n).values = [...] 明確指定列號就不會有這個問題。
 */
function setDataRow(ws: ExcelJS.Worksheet, rowIndex: number, values: (string | number)[]) {
  const row = ws.getRow(rowIndex);
  row.values = values;
}

function addSettingsSheet(wb: ExcelJS.Workbook, values: Record<string, string | number>) {
  // 系統設定固定只有 7 列資料，不適用其他工作表「整欄到第300列都標黃」的做法，
  // 所以不透過 addSheet 的 requiredColumns，改成只標示這 7 列的設定值儲存格。
  const ws = addSheet(wb, {
    name: SHEET_NAMES.settings,
    headers: SETTINGS_HEADERS,
    requiredColumns: [],
    columnFormats: {},
  });
  const rows: [string, string | number][] = [
    ["開放起日", values["開放起日"] ?? "2026-10-19"],
    ["開放迄日", values["開放迄日"] ?? "2026-10-24"],
    ["每日開始時間", values["每日開始時間"] ?? "09:00"],
    ["每日結束時間", values["每日結束時間"] ?? "21:00"],
    ["每日結單時間", values["每日結單時間"] ?? "17:00"],
    ["單趟預估時間(分鐘)", values["單趟預估時間(分鐘)"] ?? 45],
    ["系統名稱", values["系統名稱"] ?? "2026年第五屆名古屋亞帕運中繼站預約系統"],
  ];
  rows.forEach((row) => {
    const r = ws.addRow(row);
    r.getCell(2).fill = YELLOW_FILL;
  });
  ws.getColumn(1).width = 20;
  ws.getColumn(2).width = 36;
  return ws;
}

export async function buildBlankTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "2026年第五屆名古屋亞帕運中繼站管理工具";
  wb.created = new Date(2026, 0, 1); // 固定日期，避免每次產生的檔案 metadata 不同造成困惑

  addSettingsSheet(wb, {});
  buildCommonSheets(wb);

  return wb;
}

export async function buildExampleWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "2026年第五屆名古屋亞帕運中繼站管理工具";
  wb.created = new Date(2026, 0, 1);

  addSettingsSheet(wb, {});
  buildCommonSheets(wb);

  const teamsWs = wb.getWorksheet(SHEET_NAMES.teams)!;
  setDataRow(teamsWs, 2, ["T001", "田徑隊", "王小明", "0900-000-001", "", "是"]);
  setDataRow(teamsWs, 3, ["T002", "籃球隊", "李小華", "0900-000-002", "", "是"]);

  const locationsWs = wb.getWorksheet(SHEET_NAMES.locations)!;
  setDataRow(locationsWs, 2, ["L001", "名古屋中繼站", "中繼站", "愛知県名古屋市中区錦一丁目9-1", "", "是"]);
  setDataRow(locationsWs, 3, ["L002", "範例飯店A", "住宿地點", "名古屋市內範例地址A", "", "是"]);
  setDataRow(locationsWs, 4, ["L003", "範例飯店B", "住宿地點", "名古屋市內範例地址B", "", "是"]);

  const vehiclesWs = wb.getWorksheet(SHEET_NAMES.vehicles)!;
  setDataRow(vehiclesWs, 2, ["V001", "一號車", 8, "", "是"]);
  setDataRow(vehiclesWs, 3, ["V002", "二號車", 20, "", "是"]);

  const availWs = wb.getWorksheet(SHEET_NAMES.vehicleAvailability)!;
  const dates = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"];
  let availRow = 2;
  for (const d of dates) {
    setDataRow(availWs, availRow++, ["V001", d, "09:00", "21:00", "是", ""]);
    setDataRow(availWs, availRow++, ["V002", d, "09:00", "21:00", "是", ""]);
  }

  const resWs = wb.getWorksheet(SHEET_NAMES.reservations)!;
  setDataRow(resWs, 2, [
    "R261019-01", "T001", "2026-10-19", "派車", "09:00", "09:45", 4,
    "王小明", "0900-000-001", "L002", "L001", "單程", "", "示範：單程派車", "待確認",
  ]);
  setDataRow(resWs, 3, [
    "R261019-02", "T002", "2026-10-19", "派車", "10:00", "10:45", 6,
    "李小華", "0900-000-002", "L003", "L001", "來回", "18:00", "示範：來回派車", "待確認",
  ]);
  setDataRow(resWs, 4, [
    "R261019-03", "T001", "2026-10-19", "派車", "11:00", "11:45", 4,
    "王小明", "0900-000-001", "L002", "L001", "單程", "", "示範：同一預約單包含派車及治療防護（見下一列）", "待確認",
  ]);
  setDataRow(resWs, 5, [
    "R261019-03", "T001", "2026-10-19", "治療防護", "12:00", "12:30", 4,
    "王小明", "0900-000-001", "L001", "", "", "", "示範：與上一列共用同一個預約單編號 R261019-03", "待確認",
  ]);
  setDataRow(resWs, 6, [
    "R261019-04", "T002", "2026-10-19", "餐食", "12:00", "12:30", 6,
    "李小華", "0900-000-002", "", "", "", "", "示範：單獨餐食服務", "待確認",
  ]);
  setDataRow(resWs, 7, [
    "R261019-05", "T001", "2026-10-19", "運動科學", "14:00", "15:00", 4,
    "王小明", "0900-000-001", "L001", "", "", "", "示範：單獨運動科學服務", "待確認",
  ]);

  return wb;
}

export async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

import * as XLSX from "xlsx";
import { WorkingData, ShuttleTrip, LocationRow } from "@/types";
import {
  SHEET_NAMES,
  SETTINGS_HEADERS,
  TEAM_HEADERS,
  LOCATION_HEADERS,
  VEHICLE_HEADERS,
  VEHICLE_AVAILABILITY_HEADERS,
  RESERVATION_HEADERS,
  SHUTTLE_TRIP_HEADERS,
  SERVICE_CODE_TO_LABEL,
  TRIP_TYPE_CODE_TO_LABEL,
  RESERVATION_STATUS_CODE_TO_LABEL,
  LOCATION_TYPE_CODE_TO_LABEL,
  LEG_TYPE_CODE_TO_LABEL,
  TRIP_STATUS_CODE_TO_LABEL,
  ASSIGNMENT_STATUS_CODE_TO_LABEL,
  TRIP_ORIGIN_CODE_TO_LABEL,
} from "./schema";

function sheetFromRows(headers: readonly string[], rows: (string | number | boolean)[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet([headers as string[], ...rows]);
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename, { bookType: "xlsx" });
}

function locationName(locations: LocationRow[], code: string): string {
  if (!code) return "";
  return locations.find((l) => l.location_code === code)?.name ?? code;
}

// 「空白範本」與「範例資料」兩份下載改由 src/excel/styledWorkbook.ts（用 ExcelJS 產生，
// 支援必填欄位淺黃色、下拉選單、凍結首列、自動篩選、代碼欄位文字格式等樣式）負責，
// 並且是本專案附加給使用者的兩份 .xlsx 檔案的唯一產生來源，兩邊保證完全一致。
// 這裡的 exportFullWorkingData / exportSchedule 維持用 SheetJS(xlsx) 產生，
// 因為這兩者是「資料匯出」而非需要精美格式的範本，SheetJS 產生速度快、檔案小。

// ---------- 完整工作資料匯出（可重新匯入繼續作業） ----------

export function exportFullWorkingData(data: WorkingData) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(SETTINGS_HEADERS, [
      ["開放起日", data.settings.event_start_date],
      ["開放迄日", data.settings.event_end_date],
      ["每日開始時間", data.settings.daily_open_time],
      ["每日結束時間", data.settings.daily_close_time],
      ["每日結單時間", data.settings.daily_cutoff_time],
      ["單趟預估時間(分鐘)", data.settings.transport_leg_duration_minutes],
      ["系統名稱", data.settings.system_name],
    ]),
    SHEET_NAMES.settings
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      TEAM_HEADERS,
      data.teams.map((t) => [t.team_code, t.team_name, t.contact_person, t.contact_phone, t.notes, t.is_active ? "是" : "否"])
    ),
    SHEET_NAMES.teams
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      LOCATION_HEADERS,
      data.locations.map((l) => [
        l.location_code,
        l.name,
        LOCATION_TYPE_CODE_TO_LABEL[l.location_type] ?? l.location_type,
        l.address,
        l.notes,
        l.is_active ? "是" : "否",
      ])
    ),
    SHEET_NAMES.locations
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      VEHICLE_HEADERS,
      data.vehicles.map((v) => [v.vehicle_code, v.vehicle_name, v.capacity, v.notes, v.is_active ? "是" : "否"])
    ),
    SHEET_NAMES.vehicles
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      VEHICLE_AVAILABILITY_HEADERS,
      data.vehicleAvailability.map((a) => [
        a.vehicle_code,
        a.available_date,
        a.available_start_time,
        a.available_end_time,
        a.is_available ? "是" : "否",
        a.notes,
      ])
    ),
    SHEET_NAMES.vehicleAvailability
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      RESERVATION_HEADERS,
      data.reservations.map((r) => [
        r.reservation_no,
        r.team_code,
        r.reservation_date,
        SERVICE_CODE_TO_LABEL[r.service] ?? r.service,
        r.start_time,
        r.end_time,
        r.headcount,
        r.contact_person,
        r.contact_phone,
        r.pickup_location_code,
        r.dropoff_location_code,
        r.trip_type ? TRIP_TYPE_CODE_TO_LABEL[r.trip_type] ?? "" : "",
        r.return_time,
        r.notes,
        RESERVATION_STATUS_CODE_TO_LABEL[r.status] ?? r.status,
      ])
    ),
    SHEET_NAMES.reservations
  );

  XLSX.utils.book_append_sheet(wb, sheetFromRows(SHUTTLE_TRIP_HEADERS, shuttleRowsForBackup(data.shuttleTrips)), SHEET_NAMES.shuttleTrips);

  downloadWorkbook(wb, `中繼站預約工具_完整資料_${todayStamp()}.xlsx`);
}

function shuttleRowsForBackup(trips: ShuttleTrip[]): (string | number)[][] {
  return trips.map((t) => [
    t.trip_date,
    t.trip_no,
    LEG_TYPE_CODE_TO_LABEL[t.leg_type] ?? t.leg_type,
    t.vehicle_code,
    t.departure_time,
    t.pickup_location_code,
    t.dropoff_location_code,
    t.passenger_count,
    t.reservation_no,
    t.team_code,
    TRIP_STATUS_CODE_TO_LABEL[t.trip_status] ?? t.trip_status,
    ASSIGNMENT_STATUS_CODE_TO_LABEL[t.assignment_status] ?? t.assignment_status,
    TRIP_ORIGIN_CODE_TO_LABEL[t.origin] ?? t.origin,
    t.notes,
  ]);
}

// ---------- 接駁班表匯出（正式班表格式） ----------

export interface ScheduleExportOptions {
  startDate: string;
  endDate: string;
  onlyConfirmed: boolean; // true = 只匯出「行程狀態=已確認」；false = 也包含草稿與未指派
  onlyProblems?: boolean; // true = 只匯出「指派結果 != 已指派」的列（未指派及衝突清單）
}

const SCHEDULE_OUTPUT_HEADERS = [
  "日期",
  "車次",
  "車輛",
  "隊伍",
  "行程方向",
  "出發時間",
  "上車地點",
  "下車地點",
  "搭乘人數",
  "預約單編號",
  "行程狀態",
  "備註",
] as const;

export function exportSchedule(data: WorkingData, opts: ScheduleExportOptions) {
  let trips = data.shuttleTrips.filter((t) => t.trip_date >= opts.startDate && t.trip_date <= opts.endDate);

  if (opts.onlyProblems) {
    trips = trips.filter((t) => t.assignment_status !== "assigned");
  } else if (opts.onlyConfirmed) {
    trips = trips.filter((t) => t.trip_status === "confirmed");
  }

  trips = [...trips].sort((a, b) => (a.trip_date + a.departure_time).localeCompare(b.trip_date + b.departure_time));

  const teamName = (code: string) => data.teams.find((t) => t.team_code === code)?.team_name ?? code;

  const rows = trips.map((t) => {
    const vehicleLabel = t.vehicle_code
      ? `${t.vehicle_code} ${data.vehicles.find((v) => v.vehicle_code === t.vehicle_code)?.vehicle_name ?? ""}`.trim()
      : "未指派";
    const statusLabel =
      (t.assignment_status === "assigned" ? TRIP_STATUS_CODE_TO_LABEL[t.trip_status] : ASSIGNMENT_STATUS_CODE_TO_LABEL[t.assignment_status]) ??
      t.assignment_status;
    return [
      t.trip_date,
      t.trip_no,
      vehicleLabel,
      teamName(t.team_code),
      LEG_TYPE_CODE_TO_LABEL[t.leg_type] ?? t.leg_type,
      t.departure_time,
      locationName(data.locations, t.pickup_location_code),
      locationName(data.locations, t.dropoff_location_code),
      t.passenger_count,
      t.reservation_no,
      statusLabel,
      t.notes,
    ];
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromRows(SCHEDULE_OUTPUT_HEADERS, rows), "接駁班表");

  const rangeLabel = opts.startDate === opts.endDate ? opts.startDate : `${opts.startDate}_至_${opts.endDate}`;
  const kindLabel = opts.onlyProblems ? "未指派與衝突清單" : opts.onlyConfirmed ? "正式班表" : "含草稿班表";
  downloadWorkbook(wb, `接駁班表_${kindLabel}_${rangeLabel}.xlsx`);
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

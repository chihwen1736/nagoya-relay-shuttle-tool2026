import {
  ReservationRow,
  ShuttleTrip,
  SystemSettings,
  TeamRow,
  LocationRow,
  VehicleRow,
  VehicleAvailabilityRow,
  WorkingData,
  DEFAULT_SETTINGS,
} from "@/types";
import { extractRawSheet, readWorkbookFile, RawRow } from "./sheetReader";
import { parseBooleanCell, parseDateCell, parseTimeCell, cellToString, cellToNumber } from "./parseCell";
import {
  SHEET_NAMES,
  REQUIRED_SHEETS,
  SERVICE_LABEL_TO_CODE,
  TRIP_TYPE_LABEL_TO_CODE,
  RESERVATION_STATUS_LABEL_TO_CODE,
  LOCATION_TYPE_LABEL_TO_CODE,
  LEG_TYPE_LABEL_TO_CODE,
  TRIP_STATUS_LABEL_TO_CODE,
  ASSIGNMENT_STATUS_LABEL_TO_CODE,
  TRIP_ORIGIN_LABEL_TO_CODE,
} from "./schema";

export interface ValidationIssue {
  sheet: string;
  row: number | null; // Excel 實際列號，null 代表整張工作表層級的問題
  column: string | null;
  level: "error" | "warning";
  message: string;
  suggestion?: string;
}

export interface ImportParseResult {
  ok: boolean; // 是否可以匯入（沒有任何 error 等級的問題）
  issues: ValidationIssue[];
  data: WorkingData | null;
}

const SETTINGS_ITEM_MAP: Record<string, keyof SystemSettings> = {
  開放起日: "event_start_date",
  開放迄日: "event_end_date",
  每日開始時間: "daily_open_time",
  每日結束時間: "daily_close_time",
  每日結單時間: "daily_cutoff_time",
  "單趟預估時間(分鐘)": "transport_leg_duration_minutes",
  單趟預估時間: "transport_leg_duration_minutes",
  系統名稱: "system_name",
};

function err(sheet: string, row: number | null, column: string | null, message: string, suggestion?: string): ValidationIssue {
  return { sheet, row, column, level: "error", message, suggestion };
}
function warn(sheet: string, row: number | null, column: string | null, message: string, suggestion?: string): ValidationIssue {
  return { sheet, row, column, level: "warning", message, suggestion };
}

export async function parseAndValidateWorkbook(file: File): Promise<ImportParseResult> {
  const issues: ValidationIssue[] = [];
  const wb = await readWorkbookFile(file);

  const presentSheets = new Set(wb.SheetNames);
  for (const name of REQUIRED_SHEETS) {
    if (!presentSheets.has(name)) {
      issues.push(err(name, null, null, `找不到必要工作表「${name}」`, `請確認 Excel 內有一張名稱完全是「${name}」的工作表`));
    }
  }
  // 有嚴重到「連工作表結構都不完整」時，直接不往下解析內容，避免產生一堆連鎖的誤導性錯誤
  if (issues.some((i) => i.level === "error")) {
    return { ok: false, issues, data: null };
  }

  // ---------- 系統設定 ----------
  const settings: SystemSettings = { ...DEFAULT_SETTINGS };
  const settingsSheet = extractRawSheet(wb, SHEET_NAMES.settings);
  if (settingsSheet) {
    for (const row of settingsSheet.rows) {
      const item = cellToString(row.cells["設定項目"]);
      const val = row.cells["設定值"];
      if (!item) continue;
      const key = SETTINGS_ITEM_MAP[item];
      if (!key) continue; // 不認得的設定項目名稱直接忽略，不視為錯誤（可能是使用者自行加註的說明列）
      if (key === "transport_leg_duration_minutes") {
        const n = cellToNumber(val);
        if (n === null || n <= 0) {
          issues.push(warn(SHEET_NAMES.settings, row.rowNumber, "設定值", `「${item}」的值無法辨識為正數，暫用預設值 45 分鐘`));
        } else {
          settings.transport_leg_duration_minutes = n;
        }
      } else if (key === "event_start_date" || key === "event_end_date") {
        const parsed = parseDateCell(val);
        if (!parsed.ok) {
          issues.push(warn(SHEET_NAMES.settings, row.rowNumber, "設定值", `「${item}」的日期格式無法辨識，暫用預設值`, "請填 YYYY-MM-DD"));
        } else {
          settings[key] = parsed.value!;
        }
      } else if (key === "daily_open_time" || key === "daily_close_time" || key === "daily_cutoff_time") {
        const parsed = parseTimeCell(val);
        if (!parsed.ok) {
          issues.push(warn(SHEET_NAMES.settings, row.rowNumber, "設定值", `「${item}」的時間格式無法辨識，暫用預設值`, "請填 HH:mm"));
        } else {
          settings[key] = parsed.value!;
        }
      } else {
        settings.system_name = cellToString(val) || settings.system_name;
      }
    }
  }

  // ---------- 隊伍資料 ----------
  const teams: TeamRow[] = [];
  const teamCodeSeen = new Set<string>();
  const teamsSheet = extractRawSheet(wb, SHEET_NAMES.teams)!;
  for (const row of teamsSheet.rows) {
    const code = cellToString(row.cells["隊伍代碼"]);
    const name = cellToString(row.cells["隊伍名稱"]);
    if (!code) {
      issues.push(err(SHEET_NAMES.teams, row.rowNumber, "隊伍代碼", "隊伍代碼未填", "請填寫唯一的隊伍代碼，例如 T001"));
      continue;
    }
    if (teamCodeSeen.has(code)) {
      issues.push(err(SHEET_NAMES.teams, row.rowNumber, "隊伍代碼", `隊伍代碼「${code}」重複`, "請確認每個隊伍代碼只出現一次"));
      continue;
    }
    teamCodeSeen.add(code);
    if (!name) {
      issues.push(err(SHEET_NAMES.teams, row.rowNumber, "隊伍名稱", "隊伍名稱未填", "請填寫隊伍名稱，例如「羽球隊」"));
    }
    const contactPerson = cellToString(row.cells["聯絡窗口"]);
    const contactPhone = cellToString(row.cells["聯絡電話"]);
    if (!contactPerson) issues.push(warn(SHEET_NAMES.teams, row.rowNumber, "聯絡窗口", "聯絡窗口未填"));
    if (!contactPhone) issues.push(warn(SHEET_NAMES.teams, row.rowNumber, "聯絡電話", "聯絡電話未填"));
    teams.push({
      team_code: code,
      team_name: name,
      contact_person: contactPerson,
      contact_phone: contactPhone,
      notes: cellToString(row.cells["備註"]),
      is_active: parseBooleanCell(row.cells["啟用"], true),
    });
  }

  // ---------- 地點資料 ----------
  const locations: LocationRow[] = [];
  const locationCodeSeen = new Set<string>();
  const locationsSheet = extractRawSheet(wb, SHEET_NAMES.locations)!;
  for (const row of locationsSheet.rows) {
    const code = cellToString(row.cells["地點代碼"]);
    const name = cellToString(row.cells["地點名稱"]);
    const typeLabel = cellToString(row.cells["地點類型"]);
    if (!code) {
      issues.push(err(SHEET_NAMES.locations, row.rowNumber, "地點代碼", "地點代碼未填"));
      continue;
    }
    if (locationCodeSeen.has(code)) {
      issues.push(err(SHEET_NAMES.locations, row.rowNumber, "地點代碼", `地點代碼「${code}」重複`));
      continue;
    }
    locationCodeSeen.add(code);
    if (!name) issues.push(err(SHEET_NAMES.locations, row.rowNumber, "地點名稱", "地點名稱未填"));
    const typeCode = LOCATION_TYPE_LABEL_TO_CODE[typeLabel];
    if (!typeCode) {
      issues.push(
        err(SHEET_NAMES.locations, row.rowNumber, "地點類型", `地點類型「${typeLabel}」不是可用選項`, "請填「中繼站」「住宿地點」「比賽場館」或「其他」其中一種")
      );
    }
    if (!cellToString(row.cells["地址"])) issues.push(warn(SHEET_NAMES.locations, row.rowNumber, "地址", "地址未填"));
    locations.push({
      location_code: code,
      location_type: (typeCode as LocationRow["location_type"]) ?? "other",
      name,
      address: cellToString(row.cells["地址"]),
      notes: cellToString(row.cells["備註"]),
      is_active: parseBooleanCell(row.cells["啟用"], true),
    });
  }

  // ---------- 車輛資料 ----------
  const vehicles: VehicleRow[] = [];
  const vehicleCodeSeen = new Set<string>();
  const vehiclesSheet = extractRawSheet(wb, SHEET_NAMES.vehicles)!;
  for (const row of vehiclesSheet.rows) {
    const code = cellToString(row.cells["車輛代碼"]);
    if (!code) {
      issues.push(err(SHEET_NAMES.vehicles, row.rowNumber, "車輛代碼", "車輛代碼未填"));
      continue;
    }
    if (vehicleCodeSeen.has(code)) {
      issues.push(err(SHEET_NAMES.vehicles, row.rowNumber, "車輛代碼", `車輛代碼「${code}」重複`));
      continue;
    }
    vehicleCodeSeen.add(code);
    const capacity = cellToNumber(row.cells["座位數"]);
    if (capacity === null || capacity <= 0 || !Number.isInteger(capacity)) {
      issues.push(err(SHEET_NAMES.vehicles, row.rowNumber, "座位數", "座位數未填或不是正整數", "請填正整數，例如 8"));
    }
    if (!cellToString(row.cells["車輛名稱"])) issues.push(warn(SHEET_NAMES.vehicles, row.rowNumber, "車輛名稱", "車輛名稱未填"));
    vehicles.push({
      vehicle_code: code,
      vehicle_name: cellToString(row.cells["車輛名稱"]),
      capacity: capacity ?? 0,
      notes: cellToString(row.cells["備註"]),
      is_active: parseBooleanCell(row.cells["啟用"], true),
    });
  }

  // ---------- 車輛可用時段 ----------
  const vehicleAvailability: VehicleAvailabilityRow[] = [];
  const vaSheet = extractRawSheet(wb, SHEET_NAMES.vehicleAvailability)!;
  for (const row of vaSheet.rows) {
    const vehicleCode = cellToString(row.cells["車輛代碼"]);
    if (!vehicleCode) {
      issues.push(err(SHEET_NAMES.vehicleAvailability, row.rowNumber, "車輛代碼", "車輛代碼未填"));
      continue;
    }
    if (!vehicleCodeSeen.has(vehicleCode)) {
      issues.push(err(SHEET_NAMES.vehicleAvailability, row.rowNumber, "車輛代碼", `車輛代碼「${vehicleCode}」不存在於「車輛資料」`, "請確認車輛代碼有先登記在車輛資料工作表"));
      continue;
    }
    const date = parseDateCell(row.cells["日期"]);
    if (!date.ok) {
      issues.push(err(SHEET_NAMES.vehicleAvailability, row.rowNumber, "日期", "日期格式無法辨識", "請填 YYYY-MM-DD，或用 Excel 的日期格式儲存格"));
    }
    const start = parseTimeCell(row.cells["開始時間"]);
    if (!start.ok) issues.push(err(SHEET_NAMES.vehicleAvailability, row.rowNumber, "開始時間", "時間格式無法辨識", "請填 HH:mm"));
    const end = parseTimeCell(row.cells["結束時間"]);
    if (!end.ok) issues.push(err(SHEET_NAMES.vehicleAvailability, row.rowNumber, "結束時間", "時間格式無法辨識", "請填 HH:mm"));

    if (date.ok && start.ok && end.ok) {
      vehicleAvailability.push({
        vehicle_code: vehicleCode,
        available_date: date.value!,
        available_start_time: start.value!,
        available_end_time: end.value!,
        is_available: parseBooleanCell(row.cells["是否可用"], true),
        notes: cellToString(row.cells["備註"]),
      });
    }
  }

  // ---------- 預約資料 ----------
  const reservations: ReservationRow[] = [];
  const reservationServiceSeen = new Set<string>();
  const reservationsSheet = extractRawSheet(wb, SHEET_NAMES.reservations)!;
  for (const row of reservationsSheet.rows) {
    const resNo = cellToString(row.cells["預約單編號"]);
    const teamCode = cellToString(row.cells["隊伍代碼"]);
    const serviceLabel = cellToString(row.cells["服務項目"]);
    const serviceCode = SERVICE_LABEL_TO_CODE[serviceLabel];

    let rowOk = true;
    if (!resNo) {
      issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "預約單編號", "預約單編號未填"));
      rowOk = false;
    }
    if (!teamCode) {
      issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "隊伍代碼", "隊伍代碼未填"));
      rowOk = false;
    } else if (!teamCodeSeen.has(teamCode)) {
      issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "隊伍代碼", `隊伍代碼「${teamCode}」不存在於「隊伍資料」`, "請確認代碼是否打錯，或先到隊伍資料補上這支隊伍"));
      rowOk = false;
    }
    if (!serviceLabel) {
      issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "服務項目", "服務項目未填"));
      rowOk = false;
    } else if (!serviceCode) {
      issues.push(
        err(SHEET_NAMES.reservations, row.rowNumber, "服務項目", `服務項目「${serviceLabel}」不是可用選項`, "請填「派車」「餐食」「治療防護」或「運動科學」其中一種")
      );
      rowOk = false;
    }

    const date = parseDateCell(row.cells["預約日期"]);
    if (!date.ok) {
      issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "預約日期", "日期格式無法辨識", "請填 YYYY-MM-DD"));
      rowOk = false;
    }
    const start = parseTimeCell(row.cells["開始時間"]);
    if (!start.ok) {
      issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "開始時間", "時間格式無法辨識", "請填 HH:mm"));
      rowOk = false;
    }
    const end = parseTimeCell(row.cells["結束時間"]);
    if (!end.ok) {
      issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "結束時間", "時間格式無法辨識", "請填 HH:mm"));
      rowOk = false;
    }

    const headcount = cellToNumber(row.cells["人數"]);
    if (headcount === null || headcount <= 0) {
      issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "人數", "人數未填或不是正整數"));
      rowOk = false;
    }

    const contactPerson = cellToString(row.cells["聯絡人"]);
    if (!contactPerson) {
      issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "聯絡人", "聯絡人未填"));
      rowOk = false;
    }
    const contactPhone = cellToString(row.cells["聯絡電話"]);
    if (!contactPhone) issues.push(warn(SHEET_NAMES.reservations, row.rowNumber, "聯絡電話", "聯絡電話未填"));

    const pickupCode = cellToString(row.cells["上車地點代碼"]);
    const dropoffCode = cellToString(row.cells["下車地點代碼"]);

    if (serviceCode === "transport") {
      if (!pickupCode) {
        issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "上車地點代碼", "派車需求必須填上車地點代碼"));
        rowOk = false;
      } else if (!locationCodeSeen.has(pickupCode)) {
        issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "上車地點代碼", `地點代碼「${pickupCode}」不存在於「地點資料」`));
        rowOk = false;
      }
      if (!dropoffCode) {
        issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "下車地點代碼", "派車需求必須填下車地點代碼"));
        rowOk = false;
      } else if (!locationCodeSeen.has(dropoffCode)) {
        issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "下車地點代碼", `地點代碼「${dropoffCode}」不存在於「地點資料」`));
        rowOk = false;
      }
    } else if (serviceCode === "medical" || serviceCode === "sports_science") {
      // 借用「上車地點代碼」欄位當服務地點代碼
      if (!pickupCode) {
        issues.push(warn(SHEET_NAMES.reservations, row.rowNumber, "上車地點代碼", "建議填寫服務地點代碼（借用此欄位）"));
      } else if (!locationCodeSeen.has(pickupCode)) {
        issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "上車地點代碼", `地點代碼「${pickupCode}」不存在於「地點資料」`));
        rowOk = false;
      }
    } else {
      // 其他有填代碼但服務項目用不到的情況，仍檢查代碼是否存在，避免打錯字沒被發現
      if (pickupCode && !locationCodeSeen.has(pickupCode)) {
        issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "上車地點代碼", `地點代碼「${pickupCode}」不存在於「地點資料」`));
        rowOk = false;
      }
      if (dropoffCode && !locationCodeSeen.has(dropoffCode)) {
        issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "下車地點代碼", `地點代碼「${dropoffCode}」不存在於「地點資料」`));
        rowOk = false;
      }
    }

    const tripTypeLabel = cellToString(row.cells["單程或來回"]);
    const tripTypeCode = tripTypeLabel ? TRIP_TYPE_LABEL_TO_CODE[tripTypeLabel] : "";
    let returnTime = "";
    if (serviceCode === "transport") {
      if (!tripTypeLabel || !tripTypeCode) {
        issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "單程或來回", "派車需求必須填「單程」或「來回」"));
        rowOk = false;
      } else if (tripTypeCode === "round_trip") {
        const rt = parseTimeCell(row.cells["回程時間"]);
        if (!rt.ok) {
          issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "回程時間", "來回需求必須填回程時間", "請填 HH:mm，且須晚於出發時間"));
          rowOk = false;
        } else {
          returnTime = rt.value!;
        }
      }
    }

    const statusLabel = cellToString(row.cells["狀態"]);
    let statusCode: ReservationRow["status"] = "pending";
    if (statusLabel) {
      const mapped = RESERVATION_STATUS_LABEL_TO_CODE[statusLabel];
      if (!mapped) {
        issues.push(err(SHEET_NAMES.reservations, row.rowNumber, "狀態", `狀態「${statusLabel}」不是可用選項`, "請填「待確認」「已確認」或「已取消」，留白視為待確認"));
        rowOk = false;
      } else {
        statusCode = mapped as ReservationRow["status"];
      }
    }

    if (resNo && serviceCode) {
      const key = `${resNo}::${serviceCode}`;
      if (reservationServiceSeen.has(key)) {
        issues.push(
          err(SHEET_NAMES.reservations, row.rowNumber, "預約單編號", `預約單編號「${resNo}」的「${serviceLabel}」服務重複出現`, "同一張預約單的同一種服務項目只能有一列")
        );
        rowOk = false;
      } else {
        reservationServiceSeen.add(key);
      }
    }

    if (!cellToString(row.cells["備註"])) {
      issues.push(warn(SHEET_NAMES.reservations, row.rowNumber, "備註", "備註未填"));
    }

    if (rowOk) {
      reservations.push({
        reservation_no: resNo,
        team_code: teamCode,
        reservation_date: date.value!,
        service: serviceCode as ReservationRow["service"],
        start_time: start.value!,
        end_time: end.value!,
        headcount: headcount!,
        contact_person: contactPerson,
        contact_phone: contactPhone,
        pickup_location_code: pickupCode,
        dropoff_location_code: dropoffCode,
        trip_type: (tripTypeCode as ReservationRow["trip_type"]) ?? "",
        return_time: returnTime,
        notes: cellToString(row.cells["備註"]),
        status: statusCode,
      });
    }
  }

  // ---------- 接駁預排（選填） ----------
  const shuttleTrips: ShuttleTrip[] = [];
  if (presentSheets.has(SHEET_NAMES.shuttleTrips)) {
    const tripSheet = extractRawSheet(wb, SHEET_NAMES.shuttleTrips)!;
    let seq = 0;
    for (const row of tripSheet.rows) {
      seq += 1;
      const date = parseDateCell(row.cells["日期"]);
      const departure = parseTimeCell(row.cells["出發時間"]);
      const tripNo = cellToString(row.cells["車次"]);
      const legLabel = cellToString(row.cells["行程方向"]);
      const passengerCount = cellToNumber(row.cells["搭乘人數"]);
      if (!date.ok || !departure.ok || !tripNo || !legLabel || passengerCount === null) {
        issues.push(warn(SHEET_NAMES.shuttleTrips, row.rowNumber, null, "此列缺少必要欄位（日期／出發時間／車次／行程方向／搭乘人數），已略過此列的接駁預排還原"));
        continue;
      }
      const vehicleCode = cellToString(row.cells["車輛代碼"]);
      if (vehicleCode && !vehicleCodeSeen.has(vehicleCode)) {
        issues.push(warn(SHEET_NAMES.shuttleTrips, row.rowNumber, "車輛代碼", `車輛代碼「${vehicleCode}」不存在於「車輛資料」，已視為未指派`));
      }
      shuttleTrips.push({
        id: `restored-${seq}-${row.rowNumber}`,
        trip_date: date.value!,
        trip_no: tripNo,
        leg_type: (LEG_TYPE_LABEL_TO_CODE[legLabel] as ShuttleTrip["leg_type"]) ?? "one_way",
        vehicle_code: vehicleCode && vehicleCodeSeen.has(vehicleCode) ? vehicleCode : "",
        departure_time: departure.value!,
        pickup_location_code: cellToString(row.cells["上車地點代碼"]),
        dropoff_location_code: cellToString(row.cells["下車地點代碼"]),
        passenger_count: passengerCount,
        reservation_no: cellToString(row.cells["預約單編號"]),
        team_code: cellToString(row.cells["隊伍代碼"]),
        trip_status: (TRIP_STATUS_LABEL_TO_CODE[cellToString(row.cells["行程狀態"])] as ShuttleTrip["trip_status"]) ?? "draft",
        assignment_status:
          (ASSIGNMENT_STATUS_LABEL_TO_CODE[cellToString(row.cells["指派結果"])] as ShuttleTrip["assignment_status"]) ??
          (vehicleCode ? "assigned" : "unassigned"),
        origin: (TRIP_ORIGIN_LABEL_TO_CODE[cellToString(row.cells["產生方式"])] as ShuttleTrip["origin"]) ?? "system",
        notes: cellToString(row.cells["備註"]),
      });
    }
  }

  const hasError = issues.some((i) => i.level === "error");
  if (hasError) {
    return { ok: false, issues, data: null };
  }

  const data: WorkingData = {
    settings,
    teams,
    locations,
    vehicles,
    vehicleAvailability,
    reservations,
    shuttleTrips,
    importedAt: new Date().toISOString(),
  };

  return { ok: true, issues, data };
}

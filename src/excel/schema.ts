// 各工作表名稱與欄位標題的唯一定義來源，匯入驗證、範本下載、匯出都共用這份定義，
// 避免兩邊欄位名稱兜不起來。

export const SHEET_NAMES = {
  settings: "系統設定",
  teams: "隊伍資料",
  locations: "地點資料",
  vehicles: "車輛資料",
  vehicleAvailability: "車輛可用時段",
  reservations: "預約資料",
  shuttleTrips: "接駁預排",
} as const;

/** 必要工作表（6張）。「接駁預排」為選填，第一次匯入沒有它不算錯誤。 */
export const REQUIRED_SHEETS = [
  SHEET_NAMES.settings,
  SHEET_NAMES.teams,
  SHEET_NAMES.locations,
  SHEET_NAMES.vehicles,
  SHEET_NAMES.vehicleAvailability,
  SHEET_NAMES.reservations,
] as const;

export const OPTIONAL_SHEETS = [SHEET_NAMES.shuttleTrips] as const;

export const SETTINGS_HEADERS = ["設定項目", "設定值"] as const;

export const TEAM_HEADERS = ["隊伍代碼", "隊伍名稱", "聯絡窗口", "聯絡電話", "備註", "啟用"] as const;

export const LOCATION_HEADERS = ["地點代碼", "地點名稱", "地點類型", "地址", "備註", "啟用"] as const;

export const VEHICLE_HEADERS = ["車輛代碼", "車輛名稱", "座位數", "備註", "啟用"] as const;

export const VEHICLE_AVAILABILITY_HEADERS = [
  "車輛代碼",
  "日期",
  "開始時間",
  "結束時間",
  "是否可用",
  "備註",
] as const;

export const RESERVATION_HEADERS = [
  "預約單編號",
  "隊伍代碼",
  "預約日期",
  "服務項目",
  "開始時間",
  "結束時間",
  "人數",
  "聯絡人",
  "聯絡電話",
  "上車地點代碼",
  "下車地點代碼",
  "單程或來回",
  "回程時間",
  "備註",
  "狀態",
] as const;

export const SHUTTLE_TRIP_HEADERS = [
  "日期",
  "車次",
  "行程方向",
  "車輛代碼",
  "出發時間",
  "上車地點代碼",
  "下車地點代碼",
  "搭乘人數",
  "預約單編號",
  "隊伍代碼",
  "行程狀態",
  "指派結果",
  "產生方式",
  "備註",
] as const;

export const SERVICE_VALUES = ["派車", "餐食", "治療防護", "運動科學"] as const;
export const SERVICE_LABEL_TO_CODE: Record<string, string> = {
  派車: "transport",
  餐食: "meal",
  治療防護: "medical",
  運動科學: "sports_science",
};
export const SERVICE_CODE_TO_LABEL: Record<string, string> = {
  transport: "派車",
  meal: "餐食",
  medical: "治療防護",
  sports_science: "運動科學",
};

export const TRIP_TYPE_LABEL_TO_CODE: Record<string, string> = {
  單程: "one_way",
  來回: "round_trip",
};
export const TRIP_TYPE_CODE_TO_LABEL: Record<string, string> = {
  one_way: "單程",
  round_trip: "來回",
};

export const RESERVATION_STATUS_LABEL_TO_CODE: Record<string, string> = {
  待確認: "pending",
  已確認: "confirmed",
  已取消: "cancelled",
};
export const RESERVATION_STATUS_CODE_TO_LABEL: Record<string, string> = {
  pending: "待確認",
  confirmed: "已確認",
  cancelled: "已取消",
};

export const LOCATION_TYPE_LABEL_TO_CODE: Record<string, string> = {
  中繼站: "relay_station",
  住宿地點: "accommodation",
  比賽場館: "venue",
  其他: "other",
};
export const LOCATION_TYPE_CODE_TO_LABEL: Record<string, string> = {
  relay_station: "中繼站",
  accommodation: "住宿地點",
  venue: "比賽場館",
  other: "其他",
};

export const LEG_TYPE_LABEL_TO_CODE: Record<string, string> = {
  單程: "one_way",
  去程: "outbound",
  回程: "return",
};
export const LEG_TYPE_CODE_TO_LABEL: Record<string, string> = {
  one_way: "單程",
  outbound: "去程",
  return: "回程",
};

export const TRIP_STATUS_LABEL_TO_CODE: Record<string, string> = { 草稿: "draft", 已確認: "confirmed" };
export const TRIP_STATUS_CODE_TO_LABEL: Record<string, string> = { draft: "草稿", confirmed: "已確認" };

export const ASSIGNMENT_STATUS_LABEL_TO_CODE: Record<string, string> = {
  已指派: "assigned",
  未指派: "unassigned",
  有衝突: "conflict",
};
export const ASSIGNMENT_STATUS_CODE_TO_LABEL: Record<string, string> = {
  assigned: "已指派",
  unassigned: "未指派",
  conflict: "有衝突",
};

export const TRIP_ORIGIN_LABEL_TO_CODE: Record<string, string> = {
  系統自動產生: "system",
  管理者人工調整: "manual_adjusted",
  管理者人工新增: "manual_added",
};
export const TRIP_ORIGIN_CODE_TO_LABEL: Record<string, string> = {
  system: "系統自動產生",
  manual_adjusted: "管理者人工調整",
  manual_added: "管理者人工新增",
};

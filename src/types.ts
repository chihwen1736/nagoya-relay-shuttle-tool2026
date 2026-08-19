// 本檔案只定義「資料的形狀」（型別），不含任何真實隊伍／車輛／聯絡人等正式資料。
// 所有正式資料只會存在使用者的 IndexedDB（瀏覽器本機）與使用者自行匯出的 Excel 檔案裡。

export type LocationType = "relay_station" | "accommodation" | "venue" | "other";
export type ServiceCode = "transport" | "meal" | "medical" | "sports_science";
export type ReservationStatus = "pending" | "confirmed" | "cancelled";
export type TripType = "one_way" | "round_trip" | "";
export type LegType = "one_way" | "outbound" | "return";

/** 行程狀態：草稿 or 已確認（管理者人工確認後才變已確認） */
export type TripStatus = "draft" | "confirmed";
/** 指派結果：與行程狀態分開的獨立欄位，不可混用 */
export type AssignmentStatus = "assigned" | "unassigned" | "conflict";
/** 這筆車次是怎麼來的：系統自動產生 / 管理者人工調整過 / 管理者從零新增 */
export type TripOrigin = "system" | "manual_adjusted" | "manual_added";

export const SERVICE_LABELS: Record<ServiceCode, string> = {
  transport: "派車",
  meal: "餐食",
  medical: "治療防護",
  sports_science: "運動科學",
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "待確認",
  confirmed: "已確認",
  cancelled: "已取消",
};

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  draft: "草稿",
  confirmed: "已確認",
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  assigned: "已指派",
  unassigned: "未指派",
  conflict: "有衝突",
};

export const LEG_TYPE_LABELS: Record<LegType, string> = {
  one_way: "單程",
  outbound: "去程",
  return: "回程",
};

export const TRIP_ORIGIN_LABELS: Record<TripOrigin, string> = {
  system: "系統自動產生",
  manual_adjusted: "管理者人工調整",
  manual_added: "管理者人工新增",
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  relay_station: "中繼站",
  accommodation: "住宿地點",
  venue: "比賽場館",
  other: "其他",
};

export interface SystemSettings {
  event_start_date: string; // YYYY-MM-DD
  event_end_date: string;
  daily_open_time: string; // HH:mm
  daily_close_time: string;
  daily_cutoff_time: string; // HH:mm，服務日前一日的結單時間
  transport_leg_duration_minutes: number;
  system_name: string;
}

export interface TeamRow {
  team_code: string;
  team_name: string;
  contact_person: string;
  contact_phone: string;
  notes: string;
  is_active: boolean;
}

export interface LocationRow {
  location_code: string;
  location_type: LocationType;
  name: string;
  address: string;
  notes: string;
  is_active: boolean;
}

export interface VehicleRow {
  vehicle_code: string;
  vehicle_name: string;
  capacity: number;
  notes: string;
  is_active: boolean;
}

export interface VehicleAvailabilityRow {
  vehicle_code: string;
  available_date: string; // YYYY-MM-DD
  available_start_time: string; // HH:mm
  available_end_time: string; // HH:mm
  is_available: boolean;
  notes: string;
}

export interface ReservationRow {
  reservation_no: string;
  team_code: string;
  reservation_date: string; // YYYY-MM-DD
  service: ServiceCode;
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  headcount: number;
  contact_person: string;
  contact_phone: string;
  /** 派車：上車地點；治療防護／運動科學：借用此欄位當「服務地點代碼」 */
  pickup_location_code: string;
  /** 派車專用：下車地點代碼 */
  dropoff_location_code: string;
  trip_type: TripType; // 僅派車列使用
  return_time: string; // 僅派車來回列使用，HH:mm
  notes: string;
  status: ReservationStatus;
}

export interface ShuttleTrip {
  id: string; // 前端自行產生（crypto.randomUUID），非資料庫 id
  trip_date: string; // YYYY-MM-DD
  trip_no: string;
  leg_type: LegType;
  vehicle_code: string; // 空字串代表未指派
  departure_time: string; // HH:mm
  pickup_location_code: string;
  dropoff_location_code: string;
  passenger_count: number;
  reservation_no: string;
  team_code: string;
  trip_status: TripStatus;
  assignment_status: AssignmentStatus;
  origin: TripOrigin;
  notes: string;
}

export interface WorkingData {
  settings: SystemSettings;
  teams: TeamRow[];
  locations: LocationRow[];
  vehicles: VehicleRow[];
  vehicleAvailability: VehicleAvailabilityRow[];
  reservations: ReservationRow[];
  shuttleTrips: ShuttleTrip[];
  importedAt: string; // ISO timestamp，最近一次匯入/建立資料的時間，僅供畫面顯示
}

export const DEFAULT_SETTINGS: SystemSettings = {
  event_start_date: "2026-10-19",
  event_end_date: "2026-10-24",
  daily_open_time: "09:00",
  daily_close_time: "21:00",
  daily_cutoff_time: "17:00",
  transport_leg_duration_minutes: 45,
  system_name: "2026年第五屆名古屋亞帕運中繼站預約系統",
};

export function emptyWorkingData(): WorkingData {
  return {
    settings: { ...DEFAULT_SETTINGS },
    teams: [],
    locations: [],
    vehicles: [],
    vehicleAvailability: [],
    reservations: [],
    shuttleTrips: [],
    importedAt: "",
  };
}

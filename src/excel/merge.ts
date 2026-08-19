import { WorkingData, ReservationRow, TeamRow, LocationRow, VehicleRow, VehicleAvailabilityRow } from "@/types";

export interface ReservationConflict {
  key: string; // reservation_no::service
  current: ReservationRow;
  incoming: ReservationRow;
}

export interface MergePlan {
  toAdd: ReservationRow[];
  unchanged: ReservationRow[];
  conflicts: ReservationConflict[];
  incomingShuttleTripsIgnored: boolean;
}

function reservationKey(r: ReservationRow): string {
  return `${r.reservation_no}::${r.service}`;
}

function reservationsEqual(a: ReservationRow, b: ReservationRow): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 分析「合併」情境：預約資料用 預約單編號＋服務項目 辨識重複，其他主檔資料用代碼 upsert。 */
export function computeMergePlan(current: WorkingData, incoming: WorkingData): MergePlan {
  const currentByKey = new Map(current.reservations.map((r) => [reservationKey(r), r]));

  const toAdd: ReservationRow[] = [];
  const unchanged: ReservationRow[] = [];
  const conflicts: ReservationConflict[] = [];

  for (const inc of incoming.reservations) {
    const key = reservationKey(inc);
    const existing = currentByKey.get(key);
    if (!existing) {
      toAdd.push(inc);
    } else if (reservationsEqual(existing, inc)) {
      unchanged.push(inc);
    } else {
      conflicts.push({ key, current: existing, incoming: inc });
    }
  }

  return {
    toAdd,
    unchanged,
    conflicts,
    incomingShuttleTripsIgnored: incoming.shuttleTrips.length > 0,
  };
}

function upsertByCode<T, K extends keyof T>(current: T[], incoming: T[], codeField: K): T[] {
  const map = new Map<T[K], T>(current.map((row) => [row[codeField], row]));
  for (const row of incoming) {
    map.set(row[codeField], row);
  }
  return Array.from(map.values());
}

function upsertVehicleAvailability(
  current: VehicleAvailabilityRow[],
  incoming: VehicleAvailabilityRow[]
): VehicleAvailabilityRow[] {
  const key = (a: VehicleAvailabilityRow) => `${a.vehicle_code}::${a.available_date}`;
  const map = new Map(current.map((row) => [key(row), row]));
  for (const row of incoming) map.set(key(row), row);
  return Array.from(map.values());
}

export interface ConflictResolution {
  key: string;
  useIncoming: boolean; // true = 使用新資料覆蓋，false = 保留原資料
}

export function applyMergePlan(
  current: WorkingData,
  incoming: WorkingData,
  plan: MergePlan,
  resolutions: ConflictResolution[]
): WorkingData {
  const resolutionMap = new Map(resolutions.map((r) => [r.key, r.useIncoming]));

  const mergedReservations = [...current.reservations];
  const byKey = new Map(mergedReservations.map((r, idx) => [reservationKey(r), idx]));

  for (const r of plan.toAdd) {
    mergedReservations.push(r);
  }
  for (const c of plan.conflicts) {
    const useIncoming = resolutionMap.get(c.key) ?? false;
    if (useIncoming) {
      const idx = byKey.get(c.key);
      if (idx !== undefined) mergedReservations[idx] = c.incoming;
    }
  }

  return {
    settings: { ...current.settings, ...incoming.settings },
    teams: upsertByCode(current.teams, incoming.teams, "team_code"),
    locations: upsertByCode(current.locations, incoming.locations, "location_code"),
    vehicles: upsertByCode(current.vehicles, incoming.vehicles, "vehicle_code"),
    vehicleAvailability: upsertVehicleAvailability(current.vehicleAvailability, incoming.vehicleAvailability),
    reservations: mergedReservations,
    shuttleTrips: current.shuttleTrips, // 合併情境下不動既有的接駁預排，匯入檔內的接駁預排會被忽略（見 plan.incomingShuttleTripsIgnored）
    importedAt: new Date().toISOString(),
  };
}

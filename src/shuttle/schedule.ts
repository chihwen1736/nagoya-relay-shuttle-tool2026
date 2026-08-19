import { WorkingData, ShuttleTrip, ReservationRow, LegType } from "@/types";
import { addMinutesToTime, timeRangesOverlap } from "@/lib/time";
import { newId } from "@/lib/id";

interface CandidateLeg {
  reservationNo: string;
  teamCode: string;
  legType: LegType;
  departureTime: string;
  pickupCode: string;
  dropoffCode: string;
  passengerCount: number;
  pairKey: string;
}

function buildLegsForDate(reservations: ReservationRow[], tripDate: string): CandidateLeg[] {
  const legs: CandidateLeg[] = [];
  for (const r of reservations) {
    if (r.service !== "transport") continue;
    if (r.status === "cancelled") continue;
    if (r.reservation_date !== tripDate) continue;

    if (r.trip_type === "round_trip") {
      legs.push({
        reservationNo: r.reservation_no,
        teamCode: r.team_code,
        legType: "outbound",
        departureTime: r.start_time,
        pickupCode: r.pickup_location_code,
        dropoffCode: r.dropoff_location_code,
        passengerCount: r.headcount,
        pairKey: r.reservation_no,
      });
      legs.push({
        reservationNo: r.reservation_no,
        teamCode: r.team_code,
        legType: "return",
        departureTime: r.return_time,
        pickupCode: r.dropoff_location_code,
        dropoffCode: r.pickup_location_code,
        passengerCount: r.headcount,
        pairKey: r.reservation_no,
      });
    } else {
      legs.push({
        reservationNo: r.reservation_no,
        teamCode: r.team_code,
        legType: "one_way",
        departureTime: r.start_time,
        pickupCode: r.pickup_location_code,
        dropoffCode: r.dropoff_location_code,
        passengerCount: r.headcount,
        pairKey: r.reservation_no,
      });
    }
  }
  legs.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  return legs;
}

export interface GeneratePreview {
  tripDate: string;
  keepCount: number;
  keepConfirmedCount: number;
  keepManualCount: number;
  replaceCount: number;
  replacedTrips: ShuttleTrip[];
  totalLegsToConsider: number;
}

function partitionExisting(existing: ShuttleTrip[], fullRegenerate: boolean) {
  const kept: ShuttleTrip[] = [];
  const toReplace: ShuttleTrip[] = [];
  for (const t of existing) {
    if (t.trip_status === "confirmed") {
      kept.push(t);
      continue;
    }
    if (!fullRegenerate && (t.origin === "manual_adjusted" || t.origin === "manual_added")) {
      kept.push(t);
      continue;
    }
    toReplace.push(t);
  }
  return { kept, toReplace };
}

/** 在真正執行預排前，先算出「這次會被取代的範圍」，給畫面顯示二次確認用 */
export function previewGenerate(data: WorkingData, tripDate: string, fullRegenerate: boolean): GeneratePreview {
  const existing = data.shuttleTrips.filter((t) => t.trip_date === tripDate);
  const { kept, toReplace } = partitionExisting(existing, fullRegenerate);
  const legs = buildLegsForDate(data.reservations, tripDate);

  return {
    tripDate,
    keepCount: kept.length,
    keepConfirmedCount: kept.filter((t) => t.trip_status === "confirmed").length,
    keepManualCount: kept.filter((t) => t.trip_status !== "confirmed").length,
    replaceCount: toReplace.length,
    replacedTrips: toReplace,
    totalLegsToConsider: legs.length,
  };
}

/**
 * 執行預排：回傳「這一天完整的新車次清單」（保留下來的 + 新產生的）。
 * 呼叫端要自行把 data.shuttleTrips 裡屬於 tripDate 的舊資料整批換成這個回傳結果。
 */
export function generateShuttleDraftForDate(data: WorkingData, tripDate: string, fullRegenerate: boolean): ShuttleTrip[] {
  const legDuration = data.settings.transport_leg_duration_minutes || 45;
  const existing = data.shuttleTrips.filter((t) => t.trip_date === tripDate);
  const { kept } = partitionExisting(existing, fullRegenerate);

  const coveredLegKeys = new Set(kept.map((t) => `${t.reservation_no}::${t.leg_type}`));
  const allLegs = buildLegsForDate(data.reservations, tripDate);
  const legsToAssign = allLegs.filter((leg) => !coveredLegKeys.has(`${leg.reservationNo}::${leg.legType}`));

  const activeVehicles = data.vehicles.filter((v) => v.is_active);
  const availabilityForDate = data.vehicleAvailability.filter((a) => a.available_date === tripDate && a.is_available);

  // 已佔用時段：保留下來的車次（已確認 或 人工調整/新增）
  const busy = new Map<string, { start: string; end: string }[]>();
  for (const t of kept) {
    if (!t.vehicle_code) continue;
    const list = busy.get(t.vehicle_code) ?? [];
    list.push({ start: t.departure_time, end: addMinutesToTime(t.departure_time, legDuration) });
    busy.set(t.vehicle_code, list);
  }

  const assignedCountByVehicle = new Map<string, number>();
  const pairVehicle = new Map<string, string>();
  const generated: ShuttleTrip[] = [];

  for (const leg of legsToAssign) {
    const legEnd = addMinutesToTime(leg.departureTime, legDuration);

    const candidates = activeVehicles
      .map((v) => {
        const avail = availabilityForDate.find((a) => a.vehicle_code === v.vehicle_code);
        return avail ? { vehicle: v, avail } : null;
      })
      .filter((x): x is { vehicle: (typeof activeVehicles)[number]; avail: (typeof availabilityForDate)[number] } => x !== null)
      .filter(({ vehicle, avail }) => {
        if (vehicle.capacity < leg.passengerCount) return false;
        if (leg.departureTime < avail.available_start_time || legEnd > avail.available_end_time) return false;
        const busyList = busy.get(vehicle.vehicle_code) ?? [];
        const overlapsExisting = busyList.some((b) => timeRangesOverlap(leg.departureTime, legEnd, b.start, b.end));
        if (overlapsExisting) return false;
        const overlapsGenerated = generated.some(
          (g) =>
            g.vehicle_code === vehicle.vehicle_code &&
            timeRangesOverlap(leg.departureTime, legEnd, g.departure_time, addMinutesToTime(g.departure_time, legDuration))
        );
        return !overlapsGenerated;
      });

    let chosen = candidates.find((c) => c.vehicle.vehicle_code === pairVehicle.get(leg.pairKey));
    if (!chosen && candidates.length > 0) {
      const sorted = [...candidates].sort((a, b) => {
        const diffA = a.vehicle.capacity - leg.passengerCount;
        const diffB = b.vehicle.capacity - leg.passengerCount;
        if (diffA !== diffB) return diffA - diffB;
        const usedA = assignedCountByVehicle.get(a.vehicle.vehicle_code) ?? 0;
        const usedB = assignedCountByVehicle.get(b.vehicle.vehicle_code) ?? 0;
        return usedA - usedB;
      });
      chosen = sorted[0];
    }

    const vehicleCode = chosen?.vehicle.vehicle_code ?? "";
    if (vehicleCode) {
      assignedCountByVehicle.set(vehicleCode, (assignedCountByVehicle.get(vehicleCode) ?? 0) + 1);
      pairVehicle.set(leg.pairKey, vehicleCode);
    }

    generated.push({
      id: newId(),
      trip_date: tripDate,
      trip_no: "", // 稍後統一編號
      leg_type: leg.legType,
      vehicle_code: vehicleCode,
      departure_time: leg.departureTime,
      pickup_location_code: leg.pickupCode,
      dropoff_location_code: leg.dropoffCode,
      passenger_count: leg.passengerCount,
      reservation_no: leg.reservationNo,
      team_code: leg.teamCode,
      trip_status: "draft",
      assignment_status: vehicleCode ? "assigned" : "unassigned",
      origin: "system",
      notes: "",
    });
  }

  // 車次編號：避開保留下來的車次已經使用的編號
  const usedNumbers = new Set(
    kept
      .map((t) => Number(t.trip_no.split("-")[1]))
      .filter((n) => Number.isFinite(n))
  );
  const mmdd = tripDate.slice(5, 7) + tripDate.slice(8, 10);
  let seq = 1;
  for (const g of generated) {
    while (usedNumbers.has(seq)) seq++;
    g.trip_no = `${mmdd}-${String(seq).padStart(2, "0")}`;
    usedNumbers.add(seq);
    seq++;
  }

  return [...kept, ...generated];
}

/** 人工調整某一車次後，重新檢查是否與同日同車輛的其他車次時間重疊、座位是否足夠 */
export function recomputeAssignmentStatus(
  trip: ShuttleTrip,
  allTripsForDate: ShuttleTrip[],
  data: WorkingData
): ShuttleTrip["assignment_status"] {
  if (!trip.vehicle_code) return "unassigned";

  const vehicle = data.vehicles.find((v) => v.vehicle_code === trip.vehicle_code);
  if (!vehicle || vehicle.capacity < trip.passenger_count) return "conflict";

  const legDuration = data.settings.transport_leg_duration_minutes || 45;
  const tripEnd = addMinutesToTime(trip.departure_time, legDuration);

  const others = allTripsForDate.filter((t) => t.id !== trip.id && t.vehicle_code === trip.vehicle_code);
  for (const o of others) {
    const oEnd = addMinutesToTime(o.departure_time, legDuration);
    if (timeRangesOverlap(trip.departure_time, tripEnd, o.departure_time, oEnd)) return "conflict";
  }

  return "assigned";
}

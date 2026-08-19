import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { WorkingData, ShuttleTrip, emptyWorkingData } from "@/types";
import { loadWorkingData, saveWorkingData, clearWorkingData } from "@/storage/db";
import { recomputeAssignmentStatus } from "@/shuttle/schedule";
import { newId } from "@/lib/id";

type Status = "loading" | "resume-prompt" | "ready";

interface DataContextValue {
  data: WorkingData;
  status: Status;
  hasAnyData: boolean;
  savedAt: string; // 上次自動存檔時間（畫面顯示用）
  resumeYes: () => void;
  resumeNo: () => void;
  replaceData: (newData: WorkingData) => void;
  setData: (updater: (prev: WorkingData) => WorkingData) => void;
  clearAll: () => void;
  setTripsForDate: (tripDate: string, trips: ShuttleTrip[]) => void;
  updateTrip: (id: string, patch: Partial<ShuttleTrip>) => void;
  addManualTrip: (tripDate: string, partial: Partial<ShuttleTrip>) => void;
  deleteTrip: (id: string) => void;
  setTripStatus: (id: string, status: ShuttleTrip["trip_status"]) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataState] = useState<WorkingData>(emptyWorkingData());
  const [status, setStatus] = useState<Status>("loading");
  const [savedSnapshot, setSavedSnapshot] = useState<WorkingData | null>(null);
  const [savedAt, setSavedAt] = useState("");
  const skipNextAutosave = useRef(false);

  useEffect(() => {
    loadWorkingData().then((saved) => {
      if (saved && (saved.teams.length > 0 || saved.reservations.length > 0 || saved.shuttleTrips.length > 0)) {
        setSavedSnapshot(saved);
        setStatus("resume-prompt");
      } else {
        setStatus("ready");
      }
    });
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    const timer = setTimeout(() => {
      saveWorkingData(data).then(() => setSavedAt(new Date().toLocaleTimeString("zh-TW", { hour12: false })));
    }, 500);
    return () => clearTimeout(timer);
  }, [data, status]);

  const resumeYes = useCallback(() => {
    if (savedSnapshot) setDataState(savedSnapshot);
    setStatus("ready");
  }, [savedSnapshot]);

  const resumeNo = useCallback(() => {
    setDataState(emptyWorkingData());
    setStatus("ready");
  }, []);

  const replaceData = useCallback((newData: WorkingData) => {
    setDataState(newData);
  }, []);

  const setData = useCallback((updater: (prev: WorkingData) => WorkingData) => {
    setDataState((prev) => updater(prev));
  }, []);

  const clearAll = useCallback(() => {
    skipNextAutosave.current = true;
    setDataState(emptyWorkingData());
    clearWorkingData();
    setSavedAt("");
  }, []);

  const setTripsForDate = useCallback((tripDate: string, trips: ShuttleTrip[]) => {
    setDataState((prev) => ({
      ...prev,
      shuttleTrips: [...prev.shuttleTrips.filter((t) => t.trip_date !== tripDate), ...trips],
    }));
  }, []);

  const updateTrip = useCallback((id: string, patch: Partial<ShuttleTrip>) => {
    setDataState((prev) => {
      const trips = prev.shuttleTrips.map((t) => {
        if (t.id !== id) return t;
        const merged: ShuttleTrip = {
          ...t,
          ...patch,
          origin: t.origin === "manual_added" ? "manual_added" : "manual_adjusted",
        };
        return merged;
      });
      const target = trips.find((t) => t.id === id);
      if (target) {
        const sameDate = trips.filter((t) => t.trip_date === target.trip_date);
        target.assignment_status = recomputeAssignmentStatus(target, sameDate, prev);
      }
      return { ...prev, shuttleTrips: trips };
    });
  }, []);

  const addManualTrip = useCallback((tripDate: string, partial: Partial<ShuttleTrip>) => {
    setDataState((prev) => {
      const mmdd = tripDate.slice(5, 7) + tripDate.slice(8, 10);
      const usedNumbers = new Set(
        prev.shuttleTrips
          .filter((t) => t.trip_date === tripDate)
          .map((t) => Number(t.trip_no.split("-")[1]))
          .filter((n) => Number.isFinite(n))
      );
      let seq = 1;
      while (usedNumbers.has(seq)) seq++;

      const trip: ShuttleTrip = {
        id: newId(),
        trip_date: tripDate,
        trip_no: `${mmdd}-${String(seq).padStart(2, "0")}`,
        leg_type: "one_way",
        vehicle_code: "",
        departure_time: "09:00",
        pickup_location_code: "",
        dropoff_location_code: "",
        passenger_count: 1,
        reservation_no: "",
        team_code: "",
        trip_status: "draft",
        assignment_status: "unassigned",
        origin: "manual_added",
        notes: "",
        ...partial,
      };
      const sameDate = [...prev.shuttleTrips.filter((t) => t.trip_date === tripDate), trip];
      trip.assignment_status = recomputeAssignmentStatus(trip, sameDate, prev);
      return { ...prev, shuttleTrips: [...prev.shuttleTrips, trip] };
    });
  }, []);

  const deleteTrip = useCallback((id: string) => {
    setDataState((prev) => ({ ...prev, shuttleTrips: prev.shuttleTrips.filter((t) => t.id !== id) }));
  }, []);

  const setTripStatus = useCallback((id: string, tripStatus: ShuttleTrip["trip_status"]) => {
    setDataState((prev) => ({
      ...prev,
      shuttleTrips: prev.shuttleTrips.map((t) => (t.id === id ? { ...t, trip_status: tripStatus } : t)),
    }));
  }, []);

  const hasAnyData = data.teams.length > 0 || data.reservations.length > 0 || data.shuttleTrips.length > 0;

  const value: DataContextValue = {
    data,
    status,
    hasAnyData,
    savedAt,
    resumeYes,
    resumeNo,
    replaceData,
    setData,
    clearAll,
    setTripsForDate,
    updateTrip,
    addManualTrip,
    deleteTrip,
    setTripStatus,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData 必須在 DataProvider 裡面使用");
  return ctx;
}

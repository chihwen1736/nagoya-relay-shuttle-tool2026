import React, { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { SERVICE_LABELS, RESERVATION_STATUS_LABELS, ServiceCode, ReservationStatus } from "@/types";
import { isPastCutoff } from "@/lib/time";

export default function ReservationsPage() {
  const { data } = useData();
  const [dateFilter, setDateFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceCode | "">("");
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "">("");

  const locationName = (code: string) => data.locations.find((l) => l.location_code === code)?.name ?? code;
  const teamName = (code: string) => data.teams.find((t) => t.team_code === code)?.team_name ?? code;

  const rows = useMemo(() => {
    return data.reservations
      .filter((r) => !dateFilter || r.reservation_date === dateFilter)
      .filter((r) => !teamFilter || r.team_code === teamFilter)
      .filter((r) => !serviceFilter || r.service === serviceFilter)
      .filter((r) => !statusFilter || r.status === statusFilter)
      .sort((a, b) => (a.reservation_date + a.start_time).localeCompare(b.reservation_date + b.start_time));
  }, [data.reservations, dateFilter, teamFilter, serviceFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">預約資料總表</h2>

      {data.reservations.length === 0 ? (
        <p className="text-gray-400 text-sm">尚未匯入任何預約資料，請先到「Excel 匯入」頁面上傳檔案。</p>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block mb-1 text-gray-500">日期</label>
              <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full border rounded-lg px-2 py-1.5" />
            </div>
            <div>
              <label className="block mb-1 text-gray-500">隊伍</label>
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="w-full border rounded-lg px-2 py-1.5">
                <option value="">全部</option>
                {data.teams.map((t) => (
                  <option key={t.team_code} value={t.team_code}>{t.team_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-gray-500">服務項目</label>
              <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value as ServiceCode | "")} className="w-full border rounded-lg px-2 py-1.5">
                <option value="">全部</option>
                {Object.entries(SERVICE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-gray-500">狀態</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ReservationStatus | "")} className="w-full border rounded-lg px-2 py-1.5">
                <option value="">全部</option>
                {Object.entries(RESERVATION_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">預約單編號</th>
                  <th className="text-left px-3 py-2">隊伍</th>
                  <th className="text-left px-3 py-2">日期</th>
                  <th className="text-left px-3 py-2">服務項目</th>
                  <th className="text-left px-3 py-2">時間</th>
                  <th className="text-left px-3 py-2">人數</th>
                  <th className="text-left px-3 py-2">上/下車地點</th>
                  <th className="text-left px-3 py-2">聯絡人</th>
                  <th className="text-left px-3 py-2">狀態</th>
                  <th className="text-left px-3 py-2">結單提醒</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const past = r.status !== "cancelled" && isPastCutoff(r.reservation_date, data.settings.daily_cutoff_time);
                  return (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2 font-mono">{r.reservation_no}</td>
                      <td className="px-3 py-2">{teamName(r.team_code)}</td>
                      <td className="px-3 py-2">{r.reservation_date}</td>
                      <td className="px-3 py-2">{SERVICE_LABELS[r.service]}</td>
                      <td className="px-3 py-2">
                        {r.start_time}-{r.end_time}
                        {r.service === "transport" && r.trip_type === "round_trip" && r.return_time ? `（回程 ${r.return_time}）` : ""}
                      </td>
                      <td className="px-3 py-2">{r.headcount}</td>
                      <td className="px-3 py-2">
                        {r.pickup_location_code ? locationName(r.pickup_location_code) : "—"}
                        {r.service === "transport" ? ` → ${r.dropoff_location_code ? locationName(r.dropoff_location_code) : "—"}` : ""}
                      </td>
                      <td className="px-3 py-2">{r.contact_person}</td>
                      <td className="px-3 py-2">{RESERVATION_STATUS_LABELS[r.status]}</td>
                      <td className="px-3 py-2">
                        {past ? <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">已過結單時間</span> : ""}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-gray-400">沒有符合篩選條件的資料</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

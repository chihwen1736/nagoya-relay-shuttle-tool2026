import React, { useState } from "react";
import { useData } from "@/context/DataContext";
import { ASSIGNMENT_STATUS_LABELS, LEG_TYPE_LABELS, TRIP_ORIGIN_LABELS } from "@/types";

export default function AdjustPage() {
  const { data, updateTrip, addManualTrip, deleteTrip, setTripStatus } = useData();
  const [date, setDate] = useState("");

  const trips = data.shuttleTrips
    .filter((t) => t.trip_date === date)
    .sort((a, b) => a.departure_time.localeCompare(b.departure_time));

  const teamName = (code: string) => data.teams.find((t) => t.team_code === code)?.team_name ?? code;
  const locationName = (code: string) => data.locations.find((l) => l.location_code === code)?.name ?? code;

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">人工調整</h2>

      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm mb-1 text-gray-500">選擇日期</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-lg px-3 py-2" />
        </div>
        <button
          onClick={() => date && addManualTrip(date, {})}
          disabled={!date}
          className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          新增臨時車次
        </button>
      </div>

      {!date ? (
        <p className="text-gray-400 text-sm">請先選擇日期。</p>
      ) : trips.length === 0 ? (
        <p className="text-gray-400 text-sm">這天還沒有任何接駁行程，請先到「接駁行程預排」頁執行預排，或點上方「新增臨時車次」。</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="text-sm min-w-[1500px] w-full">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 text-left px-2 py-2 whitespace-nowrap w-24 min-w-[96px]">車次</th>
                <th className="sticky left-24 z-20 bg-gray-50 text-left px-2 py-2 whitespace-nowrap w-16 min-w-[64px]">方向</th>
                <th className="sticky left-40 z-20 bg-gray-50 text-left px-2 py-2 whitespace-nowrap w-36 min-w-[144px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                  出發時間
                </th>
                <th className="text-left px-2 py-2 whitespace-nowrap min-w-[180px]">上車地點代碼</th>
                <th className="text-left px-2 py-2 whitespace-nowrap min-w-[180px]">下車地點代碼</th>
                <th className="text-left px-2 py-2 whitespace-nowrap min-w-[80px]">人數</th>
                <th className="text-left px-2 py-2 whitespace-nowrap min-w-[170px]">車輛</th>
                <th className="text-left px-2 py-2 whitespace-nowrap min-w-[160px]">隊伍／單號</th>
                <th className="text-left px-2 py-2 whitespace-nowrap min-w-[130px]">來源</th>
                <th className="text-left px-2 py-2 whitespace-nowrap min-w-[180px]">備註</th>
                <th className="text-left px-2 py-2 whitespace-nowrap min-w-[110px]">指派結果</th>
                <th className="text-left px-2 py-2 whitespace-nowrap min-w-[150px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => {
                const rowBg =
                  t.assignment_status === "unassigned" ? "bg-red-50" : t.assignment_status === "conflict" ? "bg-yellow-50" : "bg-white";
                return (
                  <tr key={t.id} className={`border-t ${rowBg}`}>
                    <td className={`sticky left-0 z-10 px-2 py-2 font-mono whitespace-nowrap ${rowBg}`}>{t.trip_no}</td>
                    <td className={`sticky left-24 z-10 px-2 py-2 whitespace-nowrap ${rowBg}`}>{LEG_TYPE_LABELS[t.leg_type]}</td>
                    <td className={`sticky left-40 z-10 px-2 py-2 whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] ${rowBg}`}>
                      <input
                        type="time"
                        value={t.departure_time.slice(0, 5)}
                        onChange={(e) => updateTrip(t.id, { departure_time: e.target.value })}
                        className="border rounded px-1 py-0.5 min-w-[130px] w-32"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={t.pickup_location_code}
                        onChange={(e) => updateTrip(t.id, { pickup_location_code: e.target.value })}
                        className="border rounded px-1 py-0.5 min-w-[170px] w-full"
                      >
                        <option value="">—</option>
                        {data.locations.map((l) => (
                          <option key={l.location_code} value={l.location_code}>
                            {l.location_code} {l.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={t.dropoff_location_code}
                        onChange={(e) => updateTrip(t.id, { dropoff_location_code: e.target.value })}
                        className="border rounded px-1 py-0.5 min-w-[170px] w-full"
                      >
                        <option value="">—</option>
                        {data.locations.map((l) => (
                          <option key={l.location_code} value={l.location_code}>
                            {l.location_code} {l.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={1}
                        value={t.passenger_count}
                        onChange={(e) => updateTrip(t.id, { passenger_count: Number(e.target.value) || 1 })}
                        className="border rounded px-1 py-0.5 w-16"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={t.vehicle_code}
                        onChange={(e) => updateTrip(t.id, { vehicle_code: e.target.value })}
                        className="border rounded px-1 py-0.5 min-w-[160px] w-full"
                      >
                        <option value="">未指派</option>
                        {data.vehicles.map((v) => (
                          <option key={v.vehicle_code} value={v.vehicle_code}>
                            {v.vehicle_code}（{v.capacity}座）
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-xs whitespace-nowrap">
                      {teamName(t.team_code) || "—"}
                      <br />
                      <span className="text-gray-400 font-mono">{t.reservation_no || "（臨時車次）"}</span>
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-500 whitespace-nowrap">{TRIP_ORIGIN_LABELS[t.origin]}</td>
                    <td className="px-2 py-2">
                      <input
                        value={t.notes}
                        onChange={(e) => updateTrip(t.id, { notes: e.target.value })}
                        className="border rounded px-1 py-0.5 min-w-[160px] w-full"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold ${
                          t.assignment_status === "unassigned"
                            ? "text-red-600"
                            : t.assignment_status === "conflict"
                            ? "text-yellow-700"
                            : "text-green-700"
                        }`}
                      >
                        {ASSIGNMENT_STATUS_LABELS[t.assignment_status]}
                      </span>
                      <br />
                      <span className="text-xs text-gray-400">{t.trip_status === "confirmed" ? "已確認" : "草稿"}</span>
                    </td>
                    <td className="px-2 py-2 space-x-2 whitespace-nowrap">
                      {t.trip_status === "draft" ? (
                        <button onClick={() => setTripStatus(t.id, "confirmed")} className="text-brand-600 text-xs underline">
                          確認為正式
                        </button>
                      ) : (
                        <button onClick={() => setTripStatus(t.id, "draft")} className="text-gray-500 text-xs underline">
                          改回草稿
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`確定要刪除車次 ${t.trip_no} 嗎？`)) deleteTrip(t.id);
                        }}
                        className="text-red-600 text-xs underline"
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 p-2">
            提示：地點/車輛/上下車地點清單來自您匯入的地點資料與車輛資料；「上車地點」若沒有對應到中繼站/場館代碼，可用地點資料補齊後重新匯入。表格較寬時可左右捲動，車次／方向／出發時間會固定在左側方便對照。
          </p>
        </div>
      )}
    </div>
  );
}

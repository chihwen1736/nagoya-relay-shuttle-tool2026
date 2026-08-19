import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { previewGenerate, generateShuttleDraftForDate, GeneratePreview } from "@/shuttle/schedule";
import { ASSIGNMENT_STATUS_LABELS, TRIP_STATUS_LABELS } from "@/types";

export default function SchedulePage() {
  const { data, setTripsForDate } = useData();
  const navigate = useNavigate();

  const [date, setDate] = useState("");
  const [preview, setPreview] = useState<GeneratePreview | null>(null);
  const [fullRegenerate, setFullRegenerate] = useState(false);
  const [confirmingFull, setConfirmingFull] = useState(false);
  const [resultMsg, setResultMsg] = useState("");

  const tripsForDate = data.shuttleTrips.filter((t) => t.trip_date === date);
  const summary = {
    total: tripsForDate.length,
    confirmed: tripsForDate.filter((t) => t.trip_status === "confirmed").length,
    draft: tripsForDate.filter((t) => t.trip_status === "draft").length,
    unassigned: tripsForDate.filter((t) => t.assignment_status === "unassigned").length,
    conflict: tripsForDate.filter((t) => t.assignment_status === "conflict").length,
  };

  function runPreview() {
    if (!date) return;
    setPreview(previewGenerate(data, date, fullRegenerate));
    setResultMsg("");
  }

  function runGenerate() {
    if (!date || !preview) return;
    if (fullRegenerate && !confirmingFull) {
      setConfirmingFull(true);
      return;
    }
    const result = generateShuttleDraftForDate(data, date, fullRegenerate);
    setTripsForDate(date, result);
    setConfirmingFull(false);
    setPreview(null);
    const newlyGenerated = result.filter((t) => t.origin === "system" && t.trip_status === "draft");
    setResultMsg(
      `已產生 ${newlyGenerated.length} 段新草案（${newlyGenerated.filter((t) => t.assignment_status === "assigned").length} 段已指派、${
        newlyGenerated.filter((t) => t.assignment_status === "unassigned").length
      } 段未指派），共保留 ${result.length - newlyGenerated.length} 段原有行程未被更動。`
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">接駁行程預排</h2>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm mb-1 text-gray-500">選擇日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPreview(null);
                setConfirmingFull(false);
                setResultMsg("");
              }}
              className="border rounded-lg px-3 py-2"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fullRegenerate}
              onChange={(e) => {
                setFullRegenerate(e.target.checked);
                setPreview(null);
                setConfirmingFull(false);
              }}
            />
            全部重排（包含已人工調整過的草稿，已確認行程仍會保留）
          </label>
          <button onClick={runPreview} disabled={!date} className="border rounded-lg px-4 py-2 text-sm disabled:opacity-50">
            預覽這次會取代的範圍
          </button>
        </div>

        {date && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
            <SummaryTile label="目前總車次" value={summary.total} />
            <SummaryTile label="已確認" value={summary.confirmed} />
            <SummaryTile label="草稿" value={summary.draft} />
            <SummaryTile label="未指派" value={summary.unassigned} tone="red" />
            <SummaryTile label="有衝突" value={summary.conflict} tone="yellow" />
          </div>
        )}

        {preview && (
          <div className="border rounded-lg p-3 bg-brand-50 text-sm space-y-2">
            <p>
              本次預排範圍內共有 <b>{preview.totalLegsToConsider}</b> 段派車需求（含來回拆分）。
            </p>
            <p>
              將<b className="text-red-600">取代</b> {preview.replaceCount} 筆既有行程；
              保留 {preview.keepCount} 筆（已確認 {preview.keepConfirmedCount} 筆、人工調整/新增 {preview.keepManualCount} 筆）不受影響。
            </p>
            {preview.replaceCount > 0 && (
              <details className="text-xs text-gray-600">
                <summary className="cursor-pointer">查看將被取代的車次清單</summary>
                <ul className="list-disc list-inside mt-1">
                  {preview.replacedTrips.map((t) => (
                    <li key={t.id}>
                      {t.trip_no}｜{t.departure_time}｜{t.reservation_no}｜
                      {TRIP_STATUS_LABELS[t.trip_status]}／{ASSIGNMENT_STATUS_LABELS[t.assignment_status]}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {confirmingFull && (
              <p className="text-red-700 font-medium">
                您選擇了「全部重排」，這會連同已人工調整過的草稿一併清除重新指派（已確認行程仍會保留）。確定要繼續嗎？
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={runGenerate} className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm">
                {confirmingFull ? "確定全部重排" : "執行預排"}
              </button>
              <button
                onClick={() => {
                  setPreview(null);
                  setConfirmingFull(false);
                }}
                className="border rounded-lg px-4 py-2 text-sm"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {resultMsg && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
            <span>{resultMsg}</span>
            <button onClick={() => navigate("/adjust")} className="text-brand-700 underline text-sm ml-4 whitespace-nowrap">
              前往人工調整 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: "red" | "yellow" }) {
  const color = tone === "red" && value > 0 ? "bg-red-50 text-red-700" : tone === "yellow" && value > 0 ? "bg-yellow-50 text-yellow-700" : "bg-gray-50 text-gray-700";
  return (
    <div className={`rounded-lg p-2 text-center ${color}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}

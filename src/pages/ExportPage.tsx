import React, { useState } from "react";
import { useData } from "@/context/DataContext";
import { exportFullWorkingData, exportSchedule } from "@/excel/exportWorkbook";

export default function ExportPage() {
  const { data, clearAll } = useData();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const range = { startDate: startDate || data.settings.event_start_date, endDate: endDate || startDate || data.settings.event_end_date };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">Excel 匯出</h2>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h3 className="font-semibold">完整工作資料</h3>
        <p className="text-sm text-gray-600">
          匯出目前所有工作表資料（系統設定／隊伍／地點／車輛／車輛可用時段／預約資料／接駁預排），可以重新匯入本工具繼續作業，也是最完整的備份檔。
        </p>
        <button onClick={() => exportFullWorkingData(data)} className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm">
          下載完整資料 Excel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h3 className="font-semibold">接駁班表</h3>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <div>
            <label className="block mb-1 text-gray-500">起始日期</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block mb-1 text-gray-500">結束日期（留白＝同起始日期）</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded-lg px-3 py-2" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => exportSchedule(data, { ...range, onlyConfirmed: true })}
            className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm"
          >
            只匯出正式行程
          </button>
          <button
            onClick={() => exportSchedule(data, { ...range, onlyConfirmed: false })}
            className="border border-brand-500 text-brand-600 rounded-lg px-4 py-2 text-sm"
          >
            包含草稿及未指派行程
          </button>
          <button
            onClick={() => exportSchedule(data, { ...range, onlyConfirmed: false, onlyProblems: true })}
            className="border border-red-400 text-red-600 rounded-lg px-4 py-2 text-sm"
          >
            未指派及衝突清單
          </button>
        </div>
        <p className="text-xs text-gray-400">未指定日期時，預設使用系統設定裡的活動起訖日期範圍。</p>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h3 className="font-semibold text-red-600">清除本機資料</h3>
        <p className="text-sm text-gray-600">
          會清空目前瀏覽器裡暫存的所有資料（隊伍、地點、車輛、預約、接駁預排全部清空），且無法復原。請務必先用上方按鈕匯出備份。
        </p>
        {!confirmClear ? (
          <button onClick={() => setConfirmClear(true)} className="border border-red-500 text-red-600 rounded-lg px-4 py-2 text-sm">
            清除本機資料
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-700">確定要清除嗎？此動作無法復原。</span>
            <button
              onClick={() => {
                clearAll();
                setConfirmClear(false);
              }}
              className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm"
            >
              確定清除
            </button>
            <button onClick={() => setConfirmClear(false)} className="border rounded-lg px-4 py-2 text-sm">
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

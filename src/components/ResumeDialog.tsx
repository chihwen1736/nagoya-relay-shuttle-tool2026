import React from "react";
import { useData } from "@/context/DataContext";

export function ResumeDialog() {
  const { status, resumeYes, resumeNo } = useData();
  if (status !== "resume-prompt") return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 space-y-4">
        <h2 className="font-semibold text-lg">偵測到上次未完成的工作</h2>
        <p className="text-sm text-gray-600">
          您這台電腦的瀏覽器裡存有先前的預約與接駁預排資料，是否要繼續上次的工作？
        </p>
        <p className="text-xs text-gray-400">
          選擇「開始新的工作」會清空目前畫面（原本存在瀏覽器裡的資料在您匯入新 Excel 前不會被覆蓋，如果選錯了可以重新整理頁面再選一次「繼續」）。
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={resumeNo} className="border rounded-lg px-4 py-2 text-sm">
            開始新的工作
          </button>
          <button onClick={resumeYes} className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm">
            繼續上次工作
          </button>
        </div>
      </div>
    </div>
  );
}

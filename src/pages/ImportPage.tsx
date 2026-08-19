import React, { useRef, useState } from "react";
import { useData } from "@/context/DataContext";
import { parseAndValidateWorkbook, ValidationIssue } from "@/excel/validateAndParse";
import { exportFullWorkingData } from "@/excel/exportWorkbook";
import { buildBlankTemplateWorkbook, buildExampleWorkbook, workbookToBlob } from "@/excel/styledWorkbook";
import { triggerBlobDownload } from "@/lib/download";
import { computeMergePlan, applyMergePlan, ConflictResolution } from "@/excel/merge";
import { WorkingData } from "@/types";
import { isDateInRange } from "@/lib/time";

const BLANK_TEMPLATE_FILENAME = "2026名古屋亞帕運中繼站管理系統_空白範本.xlsx";
const EXAMPLE_DATA_FILENAME = "2026名古屋亞帕運中繼站管理系統_範例資料.xlsx";

async function downloadBlankTemplate() {
  const wb = await buildBlankTemplateWorkbook();
  const blob = await workbookToBlob(wb);
  triggerBlobDownload(blob, BLANK_TEMPLATE_FILENAME);
}

async function downloadExampleData() {
  const wb = await buildExampleWorkbook();
  const blob = await workbookToBlob(wb);
  triggerBlobDownload(blob, EXAMPLE_DATA_FILENAME);
}

// 依照 YYYY-MM-DD 日期產生 RYYMMDD- 前綴，例如 2026-10-19 → "R261019-"
function reservationNoPrefix(dateStr: string): string {
  const yy = dateStr.slice(2, 4);
  const mm = dateStr.slice(5, 7);
  const dd = dateStr.slice(8, 10);
  return `R${yy}${mm}${dd}-`;
}

// 只負責「產生／複製編號」，不會寫回 data、不會新增或修改任何預約資料——
// Excel 依然是唯一的正式資料來源，產生出來的編號要由使用者自行填入 Excel。
function ReservationNumberGenerator() {
  const { data } = useData();
  const [date, setDate] = useState("");
  const [generated, setGenerated] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function generate() {
    setGenerated("");
    setError("");
    setCopied(false);
    if (!date) return;
    const { event_start_date, event_end_date } = data.settings;
    if (!isDateInRange(date, event_start_date, event_end_date)) {
      setError(`預約日期須介於系統設定的活動日期範圍內（${event_start_date} ～ ${event_end_date}）`);
      return;
    }
    const prefix = reservationNoPrefix(date);
    let maxSeq = 0;
    for (const r of data.reservations) {
      if (!r.reservation_no.startsWith(prefix)) continue;
      const seqPart = r.reservation_no.slice(prefix.length);
      const n = Number(seqPart);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
    const nextSeq = String(maxSeq + 1).padStart(3, "0");
    setGenerated(`${prefix}${nextSeq}`);
  }

  async function copyGenerated() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API 在少數環境（例如非 HTTPS）可能無法使用，提供後備方案讓使用者手動複製
      window.prompt("請手動複製以下預約單編號：", generated);
    }
  }

  return (
    <section className="bg-white rounded-xl shadow p-4 space-y-3">
      <h2 className="font-semibold">預約單編號產生器</h2>
      <p className="text-sm text-gray-600">
        選擇預約日期後，系統會依照目前已匯入的預約資料，找出當天最大的流水號並產生下一個可用編號（格式：RYYMMDD-XXX，例如 2026-10-19
        的第一張是 R261019-001）。這裡只負責產生與複製編號，<b>不會</b>直接修改 Excel，也<b>不會</b>直接新增預約資料——請將編號複製後，自行填入 Excel 的「預約資料」工作表。
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm mb-1 text-gray-500">預約日期</label>
          <input
            type="date"
            value={date}
            min={data.settings.event_start_date}
            max={data.settings.event_end_date}
            onChange={(e) => {
              setDate(e.target.value);
              setGenerated("");
              setError("");
              setCopied(false);
            }}
            className="border rounded-lg px-3 py-2"
          />
        </div>
        <button onClick={generate} disabled={!date} className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">
          產生編號
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {generated && (
        <div className="border rounded-lg p-3 bg-brand-50 flex items-center gap-3 flex-wrap">
          <span className="font-mono text-lg font-bold text-brand-700">{generated}</span>
          <button onClick={copyGenerated} className="border border-brand-500 text-brand-600 rounded-lg px-3 py-1.5 text-sm">
            {copied ? "已複製 ✓" : "複製編號"}
          </button>
        </div>
      )}
      <p className="text-xs text-gray-500">
        提醒：同一張預約如包含派車、治療防護等多項服務，請各服務分列填寫，但使用相同的預約單編號；同一預約單編號＋同一服務項目重複出現，匯入時仍會提示錯誤。
      </p>
    </section>
  );
}

type Stage = "idle" | "validated-ok" | "validated-error" | "choose-mode" | "resolve-conflicts";

export default function ImportPage() {
  const { data, hasAnyData, replaceData } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [incoming, setIncoming] = useState<WorkingData | null>(null);
  const [fileName, setFileName] = useState("");
  const [resolutions, setResolutions] = useState<Record<string, boolean>>({});

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  async function handleFile(file: File) {
    setFileName(file.name);
    const result = await parseAndValidateWorkbook(file);
    setIssues(result.issues);
    if (!result.ok || !result.data) {
      setStage("validated-error");
      setIncoming(null);
      return;
    }
    setIncoming(result.data);
    setStage(hasAnyData ? "choose-mode" : "validated-ok");
  }

  function doReplace() {
    if (!incoming) return;
    replaceData(incoming);
    resetToIdle();
  }

  function doStartMerge() {
    if (!incoming) return;
    setStage("resolve-conflicts");
  }

  function doFreshImport() {
    if (!incoming) return;
    replaceData(incoming);
    resetToIdle();
  }

  function resetToIdle() {
    setStage("idle");
    setIssues([]);
    setIncoming(null);
    setFileName("");
    setResolutions({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const mergePlan = incoming ? computeMergePlan(data, incoming) : null;

  function finalizeMerge() {
    if (!incoming || !mergePlan) return;
    const resList: ConflictResolution[] = mergePlan.conflicts.map((c) => ({
      key: c.key,
      useIncoming: resolutions[c.key] ?? false,
    }));
    const merged = applyMergePlan(data, incoming, mergePlan, resList);
    replaceData(merged);
    resetToIdle();
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">Excel 匯入</h2>
        <p className="text-sm text-gray-600">
          請上傳整理好的 Excel 檔案（須包含系統設定／隊伍資料／地點資料／車輛資料／車輛可用時段／預約資料
          六張工作表；接駁預排為選填，用於還原先前的預排/調整成果）。
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="text-sm"
          />
          <button onClick={downloadBlankTemplate} className="border rounded-lg px-3 py-1.5 text-sm text-brand-600 border-brand-500">
            下載空白範本
          </button>
          <button onClick={downloadExampleData} className="border rounded-lg px-3 py-1.5 text-sm text-brand-600 border-brand-500">
            下載範例資料
          </button>
          {hasAnyData && (
            <button
              onClick={() => exportFullWorkingData(data)}
              className="border rounded-lg px-3 py-1.5 text-sm text-gray-600"
            >
              先匯出目前資料備份
            </button>
          )}
        </div>
      </section>

      <ReservationNumberGenerator />

      {stage === "validated-error" && (
        <section className="bg-white rounded-xl shadow p-4 space-y-3">
          <h3 className="font-semibold text-red-600">
            匯入失敗：「{fileName}」有 {errors.length} 項錯誤，請修正後重新上傳
          </h3>
          <IssueTable issues={errors} level="error" />
          {warnings.length > 0 && (
            <>
              <h4 className="font-medium text-yellow-700 mt-4">另有 {warnings.length} 項警告（修正錯誤前不影響匯入結果）</h4>
              <IssueTable issues={warnings} level="warning" />
            </>
          )}
        </section>
      )}

      {stage === "validated-ok" && incoming && (
        <section className="bg-white rounded-xl shadow p-4 space-y-3">
          <h3 className="font-semibold text-green-700">「{fileName}」驗證通過，可以匯入</h3>
          <ImportSummary data={incoming} />
          {warnings.length > 0 && (
            <>
              <h4 className="font-medium text-yellow-700 mt-4">{warnings.length} 項警告（不影響匯入，建議之後補齊）</h4>
              <IssueTable issues={warnings} level="warning" />
            </>
          )}
          <button onClick={doFreshImport} className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm">
            確認匯入
          </button>
        </section>
      )}

      {stage === "choose-mode" && incoming && (
        <section className="bg-white rounded-xl shadow p-4 space-y-4">
          <h3 className="font-semibold text-green-700">「{fileName}」驗證通過</h3>
          <ImportSummary data={incoming} />
          {warnings.length > 0 && (
            <>
              <h4 className="font-medium text-yellow-700 mt-4">{warnings.length} 項警告</h4>
              <IssueTable issues={warnings} level="warning" />
            </>
          )}
          <div className="border-t pt-4">
            <p className="text-sm text-gray-700 mb-3">
              您目前瀏覽器裡已經有工作資料（隊伍 {data.teams.length} 筆／預約 {data.reservations.length}{" "}
              筆／接駁行程 {data.shuttleTrips.length} 筆），請選擇這次匯入的處理方式：
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="border rounded-lg p-3">
                <p className="font-medium mb-1">取代目前資料</p>
                <p className="text-xs text-gray-500 mb-3">用這份新 Excel 完全覆蓋目前畫面上的所有資料，包含接駁預排。</p>
                <button
                  onClick={() => exportFullWorkingData(data)}
                  className="text-xs text-brand-600 underline block mb-2"
                >
                  先匯出目前資料備份
                </button>
                <button onClick={doReplace} className="bg-brand-600 text-white rounded-lg px-3 py-1.5 text-sm w-full">
                  確定取代
                </button>
              </div>
              <div className="border rounded-lg p-3">
                <p className="font-medium mb-1">合併資料</p>
                <p className="text-xs text-gray-500 mb-3">
                  以「預約單編號＋服務項目」比對，新增沒看過的預約、內容相同的略過，內容不同的請您逐筆選擇。隊伍／地點／車輛等主檔資料以代碼比對合併更新。
                </p>
                <button onClick={doStartMerge} className="bg-brand-600 text-white rounded-lg px-3 py-1.5 text-sm w-full">
                  開始合併
                </button>
              </div>
              <div className="border rounded-lg p-3">
                <p className="font-medium mb-1">取消匯入</p>
                <p className="text-xs text-gray-500 mb-3">不做任何變更，維持目前畫面上的資料。</p>
                <button onClick={resetToIdle} className="border rounded-lg px-3 py-1.5 text-sm w-full">
                  取消
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {stage === "resolve-conflicts" && incoming && mergePlan && (
        <section className="bg-white rounded-xl shadow p-4 space-y-4">
          <h3 className="font-semibold">合併資料</h3>
          <p className="text-sm text-gray-600">
            新增 {mergePlan.toAdd.length} 筆、內容相同略過 {mergePlan.unchanged.length} 筆、
            內容不同需要您決定 {mergePlan.conflicts.length} 筆。
          </p>
          {mergePlan.incomingShuttleTripsIgnored && (
            <p className="text-xs text-yellow-700">
              此檔案內含「接駁預排」工作表，但合併模式不會套用接駁預排內容（僅取代模式會套用），如需套用請改用「取代目前資料」。
            </p>
          )}

          {mergePlan.conflicts.length > 0 && (
            <div className="space-y-2">
              <div className="flex gap-2 text-xs">
                <button
                  className="underline text-brand-600"
                  onClick={() =>
                    setResolutions(Object.fromEntries(mergePlan.conflicts.map((c) => [c.key, true])))
                  }
                >
                  全部使用新資料
                </button>
                <button
                  className="underline text-gray-600"
                  onClick={() =>
                    setResolutions(Object.fromEntries(mergePlan.conflicts.map((c) => [c.key, false])))
                  }
                >
                  全部保留原資料
                </button>
              </div>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-2 py-1.5">預約單編號／服務</th>
                      <th className="text-left px-2 py-1.5">原資料（隊伍/日期/時間/人數）</th>
                      <th className="text-left px-2 py-1.5">新資料（隊伍/日期/時間/人數）</th>
                      <th className="text-left px-2 py-1.5">選擇</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergePlan.conflicts.map((c) => (
                      <tr key={c.key} className="border-t">
                        <td className="px-2 py-1.5 font-mono">{c.key}</td>
                        <td className="px-2 py-1.5">
                          {c.current.team_code} / {c.current.reservation_date} {c.current.start_time}-{c.current.end_time} / {c.current.headcount}人
                        </td>
                        <td className="px-2 py-1.5">
                          {c.incoming.team_code} / {c.incoming.reservation_date} {c.incoming.start_time}-{c.incoming.end_time} / {c.incoming.headcount}人
                        </td>
                        <td className="px-2 py-1.5">
                          <label className="mr-2">
                            <input
                              type="radio"
                              name={c.key}
                              checked={!resolutions[c.key]}
                              onChange={() => setResolutions((r) => ({ ...r, [c.key]: false }))}
                            />{" "}
                            保留原資料
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={c.key}
                              checked={!!resolutions[c.key]}
                              onChange={() => setResolutions((r) => ({ ...r, [c.key]: true }))}
                            />{" "}
                            使用新資料
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={finalizeMerge} className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm">
              確認合併
            </button>
            <button onClick={resetToIdle} className="border rounded-lg px-4 py-2 text-sm">
              取消
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function ImportSummary({ data }: { data: WorkingData }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
      <SummaryTile label="隊伍" value={data.teams.length} />
      <SummaryTile label="地點" value={data.locations.length} />
      <SummaryTile label="車輛" value={data.vehicles.length} />
      <SummaryTile label="預約列數" value={data.reservations.length} />
      <SummaryTile label="接駁預排" value={data.shuttleTrips.length} />
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-brand-50 rounded-lg p-2 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-bold text-brand-700">{value}</p>
    </div>
  );
}

function IssueTable({ issues, level }: { issues: ValidationIssue[]; level: "error" | "warning" }) {
  return (
    <div className={`overflow-x-auto border rounded-lg ${level === "error" ? "border-red-200" : "border-yellow-200"}`}>
      <table className="w-full text-xs">
        <thead className={level === "error" ? "bg-red-50" : "bg-yellow-50"}>
          <tr>
            <th className="text-left px-2 py-1.5">工作表</th>
            <th className="text-left px-2 py-1.5">列號</th>
            <th className="text-left px-2 py-1.5">欄位</th>
            <th className="text-left px-2 py-1.5">問題</th>
            <th className="text-left px-2 py-1.5">建議</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i, idx) => (
            <tr key={idx} className="border-t">
              <td className="px-2 py-1.5">{i.sheet}</td>
              <td className="px-2 py-1.5">{i.row ?? "—"}</td>
              <td className="px-2 py-1.5">{i.column ?? "—"}</td>
              <td className="px-2 py-1.5">{i.message}</td>
              <td className="px-2 py-1.5 text-gray-500">{i.suggestion ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

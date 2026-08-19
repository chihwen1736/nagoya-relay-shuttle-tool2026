import { get, set, del } from "idb-keyval";
import { WorkingData } from "@/types";

// 所有正式資料只存在瀏覽器的 IndexedDB 裡（透過 idb-keyval 這個輕量套件操作），
// 不會有任何 fetch/API 呼叫，也不會送到任何伺服器。清掉瀏覽器資料或換一台電腦，
// 這裡的資料就會不見，正式資料要靠使用者自己用「Excel 匯出」備份。

const STORAGE_KEY = "nagoya-relay-shuttle-tool2026:working-data";

export async function loadWorkingData(): Promise<WorkingData | null> {
  try {
    const data = await get<WorkingData>(STORAGE_KEY);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function saveWorkingData(data: WorkingData): Promise<void> {
  try {
    await set(STORAGE_KEY, data);
  } catch {
    // 存檔失敗（例如瀏覽器隱私模式限制儲存空間）不應該讓使用者卡住，
    // 只是這種情況下最好提醒使用者盡快手動匯出 Excel 備份。
  }
}

export async function clearWorkingData(): Promise<void> {
  try {
    await del(STORAGE_KEY);
  } catch {
    // 忽略
  }
}

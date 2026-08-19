// 端對端驗證腳本（非專案正式測試套件）：對照「四、驗證要求」逐項檢查
// 空白範本／範例資料上傳、接駁預排產生、人工調整、匯出功能是否正常運作。
// 執行方式：
//   npm install -D playwright   （此腳本用，正式專案不需要此套件，故未列在 package.json）
//   npm run build && npm run preview -- --port 4173 --strictPort   （另開一個終端機）
//   node scripts/verify-e2e.mjs

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import JSZip from "jszip";

const BASE = "http://localhost:4173/nagoya-relay-shuttle-tool2026/#";
const BLANK_SRC = path.resolve("2026名古屋亞帕運中繼站管理系統_空白範本.xlsx");
const EXAMPLE_SRC = path.resolve("2026名古屋亞帕運中繼站管理系統_範例資料.xlsx");
const DOWNLOAD_DIR = path.resolve("tmp-e2e-downloads");

// Playwright 的 setInputFiles 在此環境對含中文的檔名會靜默失敗（files.length 停留在 0），
// 因此先複製一份 ASCII 檔名供上傳測試使用；byte-for-byte 比對仍對照原始（中文檔名）附件內容。
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
const BLANK = path.join(DOWNLOAD_DIR, "blank_template.xlsx");
const EXAMPLE = path.join(DOWNLOAD_DIR, "example_data.xlsx");
fs.copyFileSync(BLANK_SRC, BLANK);
fs.copyFileSync(EXAMPLE_SRC, EXAMPLE);

function stripTimestamp(xml) {
  return xml.replace(/<dcterms:modified[^>]*>[^<]*<\/dcterms:modified>/, "<dcterms:modified/>");
}

async function contentEqualsIgnoringTimestamp(bufA, bufB) {
  const [zipA, zipB] = await Promise.all([JSZip.loadAsync(bufA), JSZip.loadAsync(bufB)]);
  const namesA = Object.keys(zipA.files).filter((n) => !zipA.files[n].dir).sort();
  const namesB = Object.keys(zipB.files).filter((n) => !zipB.files[n].dir).sort();
  if (namesA.length !== namesB.length || namesA.some((n, i) => n !== namesB[i])) return false;
  for (const name of namesA) {
    const isText = name.endsWith(".xml") || name.endsWith(".rels");
    if (isText) {
      let [a, b] = await Promise.all([zipA.files[name].async("string"), zipB.files[name].async("string")]);
      if (name === "docProps/core.xml") {
        a = stripTimestamp(a);
        b = stripTimestamp(b);
      }
      if (a !== b) return false;
    } else {
      const [a, b] = await Promise.all([zipA.files[name].async("nodebuffer"), zipB.files[name].async("nodebuffer")]);
      if (!a.equals(b)) return false;
    }
  }
  return true;
}

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    console.log(`PASS - ${name}`);
    pass++;
  } else {
    console.log(`FAIL - ${name}`);
    fail++;
  }
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("  [console.error]", msg.text());
  });

  // ---------- 1) 上傳空白範本，確認工作表/欄位被正確辨識 ----------
  await page.goto(`${BASE}/import`);
  await page.waitForSelector("text=Excel 匯入");
  await page.setInputFiles('input[type="file"]', BLANK);
  await page.waitForTimeout(1500);
  const blankBody = await page.textContent("body");
  check(
    "空白範本上傳後被視為驗證通過（無阻擋性錯誤）",
    blankBody.includes("驗證通過") || blankBody.includes("可以匯入")
  );
  check("空白範本未被誤判為有阻擋性錯誤（無「匯入失敗」字樣）", !blankBody.includes("匯入失敗"));

  // reset (reload) before next upload
  await page.goto(`${BASE}/import`);
  await page.waitForSelector("text=Excel 匯入");

  // ---------- 2) 上傳範例資料，確認 0 筆阻擋性錯誤 ----------
  await page.setInputFiles('input[type="file"]', EXAMPLE);
  await page.waitForTimeout(1500);
  const exampleBody = await page.textContent("body");
  check("範例資料上傳後顯示「驗證通過」", exampleBody.includes("驗證通過"));
  check("範例資料上傳沒有出現「匯入失敗」", !exampleBody.includes("匯入失敗"));

  // confirm import
  const confirmBtn = page.getByRole("button", { name: "確認匯入" });
  if (await confirmBtn.count()) {
    await confirmBtn.click();
  } else {
    // hasAnyData 情境下走 choose-mode
    const replaceBtn = page.getByRole("button", { name: "確定取代" });
    if (await replaceBtn.count()) await replaceBtn.click();
  }
  await page.waitForTimeout(500);

  // ---------- 3) 用範例資料產生接駁預排 ----------
  await page.goto(`${BASE}/schedule`);
  await page.waitForSelector("text=接駁行程預排");
  await page.fill('input[type="date"]', "2026-10-19");
  await page.getByRole("button", { name: "預覽這次會取代的範圍" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "執行預排" }).click();
  await page.waitForTimeout(800);
  const scheduleBody = await page.textContent("body");
  check("執行預排後顯示產生結果訊息", scheduleBody.includes("已產生") && scheduleBody.includes("段新草案"));

  // ---------- 4) 確認單程與來回行程正確產生 ----------
  await page.goto(`${BASE}/adjust`);
  await page.waitForSelector("text=人工調整");
  await page.fill('input[type="date"]', "2026-10-19");
  await page.waitForTimeout(500);
  const rows = await page.locator("table tbody tr").all();
  const rowTexts = [];
  for (const r of rows) rowTexts.push(await r.textContent());
  console.log(`  共 ${rowTexts.length} 段行程`);
  const oneWayCount = rowTexts.filter((t) => t.includes("R261019-01") || t.includes("R261019-03")).length;
  const roundTripLegs = rowTexts.filter((t) => t.includes("R261019-02"));
  check("單程需求（R261019-01, R261019-03）有產生對應行程", oneWayCount >= 2);
  check("來回需求（R261019-02）拆分為 2 段（去程+回程）", roundTripLegs.length === 2);
  check(
    "來回需求包含「去程」與「回程」兩種方向",
    roundTripLegs.some((t) => t.includes("去程")) && roundTripLegs.some((t) => t.includes("回程"))
  );

  // ---------- 5) 確認人工調整可運作 ----------
  if (rowTexts.length > 0) {
    const firstTimeInput = page.locator("table tbody tr").first().locator('input[type="time"]');
    await firstTimeInput.fill("08:30");
    await page.waitForTimeout(300);
    const val = await firstTimeInput.inputValue();
    check("人工調整出發時間可成功修改", val === "08:30");

    const firstNotesInput = page.locator("table tbody tr").first().locator('input:not([type="time"]):not([type="number"])').first();
    await firstNotesInput.fill("驗證測試備註");
    await page.waitForTimeout(300);
    check("人工調整備註欄可成功輸入", (await firstNotesInput.inputValue()) === "驗證測試備註");
  } else {
    check("人工調整可運作（無資料可測試）", false);
  }

  // ---------- 6) 確認匯出功能可運作 ----------
  await page.goto(`${BASE}/export`);
  await page.waitForSelector("text=Excel 匯出");

  const [download1] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "下載完整資料 Excel" }).click(),
  ]);
  const path1 = await download1.path();
  check("「完整工作資料」匯出成功產生檔案", !!path1 && fs.existsSync(path1));

  await page.fill('input[type="date"]', "2026-10-19");
  const [download2] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "只匯出正式行程" }).click(),
  ]);
  const path2 = await download2.path();
  check("「正式接駁班表」匯出成功產生檔案", !!path2 && fs.existsSync(path2));

  // ---------- extra: 確認下載空白範本/範例資料按鈕與附件一致 ----------
  await page.goto(`${BASE}/import`);
  await page.waitForSelector("text=Excel 匯入");
  const [dlBlank] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "下載空白範本" }).click(),
  ]);
  const dlBlankPath = await dlBlank.path();
  await dlBlank.saveAs(path.join(DOWNLOAD_DIR, "app_downloaded_blank.xlsx"));
  const [dlExample] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "下載範例資料" }).click(),
  ]);
  const dlExamplePath = await dlExample.path();
  await dlExample.saveAs(path.join(DOWNLOAD_DIR, "app_downloaded_example.xlsx"));

  // 註：ExcelJS 會在 docProps/core.xml 寫入產生當下的 <dcterms:modified> 時間戳記，
  // 因此兩次各自產生的檔案在該單一時間戳記欄位上必然不同；比較內容時排除此欄位，
  // 其餘所有工作表資料／樣式／驗證規則／結構皆須完全一致。
  const same1 = dlBlankPath && (await contentEqualsIgnoringTimestamp(fs.readFileSync(dlBlankPath), fs.readFileSync(BLANK_SRC)));
  const same2 = dlExamplePath && (await contentEqualsIgnoringTimestamp(fs.readFileSync(dlExamplePath), fs.readFileSync(EXAMPLE_SRC)));
  check("系統內「下載空白範本」與附件檔案內容完全一致（僅產生時間戳記不同）", !!same1);
  check("系統內「下載範例資料」與附件檔案內容完全一致（僅產生時間戳記不同）", !!same2);

  await browser.close();

  console.log(`\n合計：${pass} 項通過、${fail} 項失敗`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

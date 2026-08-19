// 驗證本次「寬版介面」與「預約單編號產生器」改動的端對端腳本（非專案正式測試套件）。
// 執行方式：
//   npm install -D playwright   （此腳本用，正式專案不需要此套件，故未列在 package.json）
//   npm run build && npm run preview -- --port 4173 --strictPort   （另開一個終端機）
//   node scripts/verify-layout-and-generator.mjs

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://localhost:4173/nagoya-relay-shuttle-tool2026/#";
const EXAMPLE_SRC = path.resolve("2026名古屋亞帕運中繼站管理系統_範例資料.xlsx");

const DOWNLOAD_DIR = path.resolve("tmp-e2e-downloads");
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
// setInputFiles 對中文檔名在此環境會靜默失敗，先複製一份 ASCII 檔名再上傳。
const EXAMPLE = path.join(DOWNLOAD_DIR, "example_data.xlsx");
fs.copyFileSync(EXAMPLE_SRC, EXAMPLE);

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
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("  [pageerror]", err.message));

  // ---------- 一、寬版介面 ----------

  // 一般頁面（Excel 匯入）維持原本較窄的寬度
  await page.goto(`${BASE}/import`);
  await page.waitForSelector("text=Excel 匯入");
  const importMainWidth = await page.locator("main").evaluate((el) => el.getBoundingClientRect().width);
  console.log(`  /import main 寬度 = ${importMainWidth}px`);
  check("一般頁面（Excel 匯入）main 寬度維持在 max-w-6xl 範圍內（<= 1200px）", importMainWidth <= 1200);

  // 接駁行程預排／人工調整改成接近全螢幕寬度
  await page.goto(`${BASE}/schedule`);
  await page.waitForSelector("text=接駁行程預排");
  const scheduleMainWidth = await page.locator("main").evaluate((el) => el.getBoundingClientRect().width);
  console.log(`  /schedule main 寬度 = ${scheduleMainWidth}px`);
  check("「接駁行程預排」main 寬度 >= 1600px", scheduleMainWidth >= 1600);

  await page.goto(`${BASE}/adjust`);
  await page.waitForSelector("text=人工調整");
  const adjustMainWidth = await page.locator("main").evaluate((el) => el.getBoundingClientRect().width);
  console.log(`  /adjust main 寬度 = ${adjustMainWidth}px`);
  check("「人工調整」main 寬度 >= 1600px", adjustMainWidth >= 1600);

  // 先匯入範例資料，讓後面的預排/調整/取號測試有資料可用
  await page.goto(`${BASE}/import`);
  await page.waitForSelector("text=Excel 匯入");
  await page.setInputFiles('input[type="file"]', EXAMPLE);
  await page.waitForTimeout(1200);
  const confirmBtn = page.getByRole("button", { name: "確認匯入" });
  if (await confirmBtn.count()) {
    await confirmBtn.click();
  } else {
    const replaceBtn = page.getByRole("button", { name: "確定取代" });
    if (await replaceBtn.count()) await replaceBtn.click();
  }
  await page.waitForTimeout(500);

  await page.goto(`${BASE}/schedule`);
  await page.waitForSelector("text=接駁行程預排");
  await page.fill('input[type="date"]', "2026-10-19");
  await page.getByRole("button", { name: "預覽這次會取代的範圍" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "執行預排" }).click();
  await page.waitForTimeout(600);

  // ---------- 人工調整表格：可橫向捲動、維持最小寬度、出發時間 input 夠寬 ----------
  await page.goto(`${BASE}/adjust`);
  await page.waitForSelector("text=人工調整");
  await page.fill('input[type="date"]', "2026-10-19");
  await page.waitForTimeout(500);

  const scrollBox = page.locator(".overflow-x-auto").first();
  const hasScrollBox = (await scrollBox.count()) > 0;
  check("人工調整表格外層有 overflow-x-auto 容器", hasScrollBox);

  const table = page.locator("table").first();
  const tableWidth = await table.evaluate((el) => el.getBoundingClientRect().width);
  console.log(`  人工調整 table 寬度 = ${tableWidth}px`);
  check("人工調整 table 維持最小寬度（>= 1500px）", tableWidth >= 1500);

  const timeInput = page.locator('input[type="time"]').first();
  const timeInputWidth = await timeInput.evaluate((el) => el.getBoundingClientRect().width);
  console.log(`  出發時間 input 寬度 = ${timeInputWidth}px`);
  check("出發時間 input 寬度 >= 130px（不是舊版的 w-24／96px）", timeInputWidth >= 130);

  // 車次／方向／出發時間三個欄位設為 sticky，橫向捲動時仍固定在左側
  const stickyCount = await page.locator("table thead th.sticky").count();
  check("車次／方向／出發時間三個表頭欄位設為 sticky", stickyCount === 3);

  // ---------- 預約資料總表也檢查沒有欄位擠壓 ----------
  await page.goto(`${BASE}/reservations`);
  await page.waitForSelector("text=預約資料總表");
  const resTable = page.locator("table").first();
  const resTableWidth = await resTable.evaluate((el) => el.getBoundingClientRect().width);
  console.log(`  預約資料總表 table 寬度 = ${resTableWidth}px`);
  check("預約資料總表 table 維持最小寬度（>= 1200px）", resTableWidth >= 1200);
  const resScrollBox = page.locator(".overflow-x-auto").first();
  check("預約資料總表外層有 overflow-x-auto 容器", (await resScrollBox.count()) > 0);

  // ---------- 二、預約單編號產生器 ----------
  await page.goto(`${BASE}/import`);
  await page.waitForSelector("text=預約單編號產生器");

  // 情境 1：當天已有資料（範例資料裡 2026-10-19 最大流水號應該是 5，不論原本是幾位數）
  await page.fill('input[type="date"]', "2026-10-19");
  await page.getByRole("button", { name: "產生編號" }).click();
  await page.waitForTimeout(300);
  let genText = await page.locator("span.font-mono").first().textContent();
  console.log(`  2026-10-19 產生結果 = ${genText}`);
  check("當天已有資料時，產生格式為 RYYMMDD-XXX（三位數）", /^R261019-\d{3}$/.test(genText ?? ""));
  check("當天已有資料時，流水號正確接續在既有最大號之後（R261019-006）", genText === "R261019-006");

  // 情境 2：當天完全沒有資料，從 001 開始
  await page.fill('input[type="date"]', "2026-10-20");
  await page.getByRole("button", { name: "產生編號" }).click();
  await page.waitForTimeout(300);
  genText = await page.locator("span.font-mono").first().textContent();
  console.log(`  2026-10-20 產生結果 = ${genText}`);
  check("當天沒有資料時，從 001 開始", genText === "R261020-001");

  // 情境 3：複製編號按鈕可運作（give clipboard permission first）
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "複製編號" }).click();
  await page.waitForTimeout(300);
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  check("「複製編號」按鈕會把產生的編號複製到剪貼簿", clipboardText === "R261020-001");
  const copiedLabel = await page.getByRole("button", { name: /已複製/ }).count();
  check("複製後按鈕文字變成「已複製」", copiedLabel > 0);

  // 情境 4：日期超出系統設定的活動日期範圍時應該被擋下
  await page.fill('input[type="date"]', "2026-09-01");
  await page.getByRole("button", { name: "產生編號" }).click();
  await page.waitForTimeout(300);
  const bodyText = await page.textContent("body");
  check("日期超出活動範圍時顯示錯誤訊息、不產生編號", bodyText.includes("須介於系統設定的活動日期範圍內"));

  await browser.close();

  console.log(`\n合計：${pass} 項通過、${fail} 項失敗`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

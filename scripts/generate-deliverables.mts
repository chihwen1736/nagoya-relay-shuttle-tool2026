import { buildBlankTemplateWorkbook, buildExampleWorkbook } from "../src/excel/styledWorkbook";
import fs from "node:fs";

async function main() {
  const blank = await buildBlankTemplateWorkbook();
  await blank.xlsx.writeFile("2026名古屋亞帕運中繼站管理系統_空白範本.xlsx");

  const example = await buildExampleWorkbook();
  await example.xlsx.writeFile("2026名古屋亞帕運中繼站管理系統_範例資料.xlsx");

  console.log("done", fs.existsSync("2026名古屋亞帕運中繼站管理系統_空白範本.xlsx"), fs.existsSync("2026名古屋亞帕運中繼站管理系統_範例資料.xlsx"));
}

main();

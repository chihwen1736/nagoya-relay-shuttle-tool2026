import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useData } from "@/context/DataContext";

const NAV_ITEMS = [
  { to: "/import", label: "Excel 匯入" },
  { to: "/reservations", label: "預約資料總表" },
  { to: "/schedule", label: "接駁行程預排" },
  { to: "/adjust", label: "人工調整" },
  { to: "/export", label: "Excel 匯出" },
];

// 「接駁行程預排」與「人工調整」頁面表格欄位多，維持一般頁面的 max-w-6xl 會把表格擠得很窄，
// 這兩頁改用接近全螢幕的寬度；其餘頁面維持原本寬度不變。
const WIDE_PAGES = ["/schedule", "/adjust"];

export function Layout({ children }: { children: React.ReactNode }) {
  const { savedAt, hasAnyData } = useData();
  const location = useLocation();
  const isWidePage = WIDE_PAGES.includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <h1 className="text-lg font-bold leading-tight">2026年第五屆名古屋亞帕運中繼站管理工具</h1>
          <p className="text-xs text-brand-100 mt-0.5">
            管理者專用｜資料只存在您目前使用的瀏覽器裡，不會上傳到任何伺服器｜結單時間判斷以日本時間（Asia/Tokyo）為準
          </p>
        </div>
      </header>
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-2 flex gap-4 text-sm flex-wrap items-center">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-1 py-0.5 ${isActive ? "text-brand-700 font-semibold border-b-2 border-brand-600" : "text-gray-500 hover:text-brand-600"}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <span className="ml-auto text-xs text-gray-400">
            {hasAnyData ? (savedAt ? `已自動存檔於本機（${savedAt}）` : "資料變動中…") : "尚未匯入任何資料"}
          </span>
        </div>
      </nav>
      <main className={`flex-1 w-full mx-auto px-4 py-6 ${isWidePage ? "max-w-[1800px]" : "max-w-6xl"}`}>{children}</main>
      <footer className="text-center text-xs text-gray-400 py-4">
        本工具為純前端靜態網站，Excel 是正式資料主檔，請定期使用「Excel 匯出」備份您的工作進度。
      </footer>
    </div>
  );
}

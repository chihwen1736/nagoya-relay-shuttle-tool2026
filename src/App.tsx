import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { DataProvider, useData } from "@/context/DataContext";
import { Layout } from "@/components/Layout";
import { ResumeDialog } from "@/components/ResumeDialog";
import ImportPage from "@/pages/ImportPage";
import ReservationsPage from "@/pages/ReservationsPage";
import SchedulePage from "@/pages/SchedulePage";
import AdjustPage from "@/pages/AdjustPage";
import ExportPage from "@/pages/ExportPage";

function Gate({ children }: { children: React.ReactNode }) {
  const { status } = useData();
  if (status === "loading") {
    return <div className="p-8 text-center text-gray-400">載入中…</div>;
  }
  return (
    <>
      <ResumeDialog />
      {status === "ready" && children}
    </>
  );
}

export default function App() {
  return (
    <DataProvider>
      <HashRouter>
        <Gate>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/import" replace />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/reservations" element={<ReservationsPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/adjust" element={<AdjustPage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="*" element={<Navigate to="/import" replace />} />
            </Routes>
          </Layout>
        </Gate>
      </HashRouter>
    </DataProvider>
  );
}

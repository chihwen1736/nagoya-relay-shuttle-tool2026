import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// GitHub Pages 會把網站部署在 https://<帳號>.github.io/<repo名稱>/ 這種子路徑下，
// 所以 base 必須設成 "/<repo名稱>/"，否則所有資源（JS/CSS）路徑都會抓錯導致空白頁。
// 若您改用自己的網域（custom domain）部署在根目錄，把 base 改回 "/" 即可。
export default defineConfig({
  base: "/nagoya-relay-shuttle-tool2026/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
  },
});

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          500: "#2f5fdc",
          600: "#254bb0",
          700: "#1d3a8a",
        },
      },
    },
  },
  plugins: [],
};

export default config;

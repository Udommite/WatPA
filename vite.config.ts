import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "WatAssets ระบบทะเบียนทรัพย์สินวัด",
        short_name: "WatAssets",
        lang: "th",
        start_url: "/",
        display: "standalone",
        background_color: "#f6f7f3",
        theme_color: "#173e35",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,svg,ttf}"],
        maximumFileSizeToCacheInBytes: 4000000,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:3100" } },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "ASHA Setu",
        short_name: "ASHA Setu",
        description:
          "Speak a home visit. ASHA Setu writes the report, reads it back, and flags the families who need attention.",
        theme_color: "#0f4c46",
        background_color: "#f7f5ee",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "en",
        categories: ["health", "medical", "productivity"],
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Record a visit",
            short_name: "Record",
            url: "/record",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Supervisor overview",
            short_name: "Overview",
            url: "/dashboard",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.*\.woff2$/,
            handler: "CacheFirst",
            options: {
              cacheName: "asha-fonts",
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/ws": { target: "ws://127.0.0.1:8000", ws: true },
    },
  },
});

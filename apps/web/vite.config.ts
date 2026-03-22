import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Local API: `vercel dev --listen 5173`. You use `pnpm dev` on 3030; Vercel spawns its own Vite with VERCEL=1 → 3031 to avoid a port clash. */
const LOCAL_VERCEL_DEV_URL = "http://127.0.0.1:5173";

const DEFAULT_DEV_PORT = 3030;
/** When `vercel dev` starts Vite as a subprocess, it sets `VERCEL=1`; use a different port than standalone `pnpm dev`. */
const VERCEL_SPAWNED_VITE_PORT = 3031;

function resolveDevServerPort(): number {
  const fromEnv = Number(process.env.VITE_DEV_PORT);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  if (process.env.VERCEL === "1") return VERCEL_SPAWNED_VITE_PORT;
  return DEFAULT_DEV_PORT;
}

export default defineConfig({
  server: {
    port: resolveDevServerPort(),
    strictPort: true,
    proxy: {
      // `pnpm dev` (this server) proxies /api → vercel dev on 5173 by default.
      "/api": {
        target: process.env.VITE_VERCEL_DEV_URL ?? LOCAL_VERCEL_DEV_URL,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icon.svg"],
      manifest: {
        name: "NutriLog",
        short_name: "NutriLog",
        description: "Personal nutrition and calorie tracking",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

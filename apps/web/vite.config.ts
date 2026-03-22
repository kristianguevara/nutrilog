import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Local API: `vercel dev --listen 5173`. Standalone `pnpm dev` uses port 3030; `vercel dev` passes `PORT` to its child Vite — must match that or Vercel fails its dev-server probe. */
const LOCAL_VERCEL_DEV_URL = "http://127.0.0.1:5173";

const DEFAULT_DEV_PORT = 3030;

function resolveDevServerPort(): number {
  const port = Number(process.env.PORT);
  if (Number.isFinite(port) && port > 0) return port;
  const viteDevPort = Number(process.env.VITE_DEV_PORT);
  if (Number.isFinite(viteDevPort) && viteDevPort > 0) return viteDevPort;
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

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FOOD_SCAN_MOCK?: string;
  readonly VITE_VERCEL_DEV_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

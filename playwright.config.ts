import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://localhost:5180",
    trace: "retain-on-failure",
    ...(process.platform === "win32" ? { channel: "chrome" } : {}),
  },
  webServer: {
    command: "node node_modules/vinext/dist/cli.js dev --port 5180",
    url: "http://localhost:5180",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_ROOMLY_MODE: "demo",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    },
  },
});

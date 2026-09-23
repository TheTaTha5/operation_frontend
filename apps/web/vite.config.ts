import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.DEV_BACKEND_URL || "http://localhost:3000";
  // Proxy everything server.js owns so the dev app, the API and the legacy app share one origin
  // (and therefore the `sess` cookie), exactly as they will in production.
  const proxied = ["/api", "/auth", "/allotment_v2"];

  return {
    base: env.VITE_BASE || "/app/",
    plugins: [vue()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      proxy: Object.fromEntries(proxied.map((p) => [p, { target: backend, changeOrigin: false }])),
    },
    test: {
      environment: "jsdom",
    },
  };
});

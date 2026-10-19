import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { target: "es2020", assetsInlineLimit: 0, chunkSizeWarningLimit: 700 },
  server: { host: "127.0.0.1", port: 5173 },
});

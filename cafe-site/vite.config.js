import { defineConfig } from "vite";

// base "./": o site é publicado em https://guisantosss.github.io/MeusSites/cafe-site/
export default defineConfig({
  base: "./",
  build: { target: "es2020", assetsInlineLimit: 0 },
  server: { host: "127.0.0.1", port: 5174 },
});

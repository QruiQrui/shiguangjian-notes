import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(import.meta.dirname, "pages"),
  base: "./",
  plugins: [
    {
      name: "flatten-public-card-assets",
      enforce: "pre",
      transform(code, id) {
        if (id.endsWith("app/page.tsx")) return code.replaceAll("${PUBLIC_BASE}floral/", "${PUBLIC_BASE}");
        if (id.endsWith("app/globals.css")) return code.replaceAll("/floral/", "/");
      },
    },
    react(),
  ],
  publicDir: resolve(import.meta.dirname, "public"),
  build: {
    outDir: resolve(import.meta.dirname, "pages-dist"),
    emptyOutDir: true,
    assetsDir: "",
    rollupOptions: {
      input: resolve(import.meta.dirname, "pages/index.html"),
      output: {
        entryFileNames: "app.js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});

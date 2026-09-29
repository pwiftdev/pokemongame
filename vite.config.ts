import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  root: "apps/client",
  envDir: resolve("."),
  server: { port: 5173, proxy: { "/api": "http://localhost:2567" } },
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      input: {
        main: resolve("apps/client/index.html"),
        inspect: resolve("apps/client/inspect.html"),
      },
    },
  },
});

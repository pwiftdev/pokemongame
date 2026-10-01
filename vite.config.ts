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
        characterStudio: resolve("apps/client/character-studio.html"),
        soundStudio: resolve("apps/client/sound-studio.html"),
        main: resolve("apps/client/index.html"),
        inspect: resolve("apps/client/inspect.html"),
        worldTour: resolve("apps/client/world-tour.html"),
        pokemonBenchmark: resolve("apps/client/pokemon-benchmark.html"),
      },
    },
  },
});

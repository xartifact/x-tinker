import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      // config-store uses node:fs/promises + node:path — keep them external
      // so the lib stays usable in Node/Bun instead of being stubbed out
      external: [/^node:/],
    },
  },
  plugins: [dts({ rollupTypes: true })],
});

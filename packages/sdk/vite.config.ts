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
      external: ["@xartifact/x-tinker-shared", "hono", /^hono\/.*/],
    },
  },
  plugins: [dts({ rollupTypes: true })],
});

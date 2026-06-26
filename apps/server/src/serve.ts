import type { Hono } from "hono";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Start the Hono server.
 * In production with UI_DIST_PATH set, serves the built UI as a SPA fallback.
 */
export function serve(app: Hono, port: number): void {
  console.log(`[x-tinker] Starting on http://localhost:${port}`);

  const uiDist = process.env.UI_DIST_PATH;
  if (uiDist && existsSync(uiDist)) {
    const indexHtml = readFileSync(resolve(uiDist, "index.html"), "utf-8");

    app.get("/*", (c) => {
      const url = new URL(c.req.url);
      const filePath = resolve(uiDist, url.pathname.slice(1));
      if (existsSync(filePath) && !filePath.endsWith(".html")) {
        const content = readFileSync(filePath);
        const ext = filePath.split(".").pop() ?? "";
        const mime: Record<string, string> = {
          js: "application/javascript",
          css: "text/css",
          svg: "image/svg+xml",
          png: "image/png",
          ico: "image/x-icon",
          json: "application/json",
          html: "text/html",
        };
        return c.body(content, 200, { "Content-Type": mime[ext] ?? "application/octet-stream" });
      }
      // SPA fallback
      return c.html(indexHtml);
    });

    console.log(`[x-tinker] Serving UI from ${uiDist}`);
  }

  Bun.serve({
    port,
    fetch: app.fetch,
  });

  console.log(`[x-tinker] Ready at http://localhost:${port}`);
}

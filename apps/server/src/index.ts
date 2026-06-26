/**
 * x-tinker server — receives error events and runs the fix pipeline.
 *
 * Configuration via environment variables:
 *   PORT            - Server port (default: 3200)
 *   DB_DIR          - PGlite data directory (default: ".x-tinker/db")
 *   LLM_PROVIDER    - LLM provider name (default: "openai")
 *   LLM_MODEL       - Model name (default: "gpt-4o")
 *   LLM_API_KEY     - API key for the LLM provider
 *   LLM_BASE_URL    - Base URL for the LLM API (optional)
 *   PROJECT_A_PATH  - Path to Project A's source code (for reading source files)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { resolve } from "node:path";
import { serve } from "./serve.js";
import { pipelineRouter } from "./routes/pipeline.js";
import { trpcRouter } from "./routes/trpc.js";
import { createDb } from "@xartifact/x-tinker-db";

const app = new Hono();

// ─── Middleware ────────────────────────────────────────────────
app.use("*", logger());
app.use("*", cors());

// ─── Routes ────────────────────────────────────────────────────
app.get("/", (c) => c.json({ service: "x-tinker", status: "ok" }));
app.get("/health", (c) => c.json({ status: "healthy" }));

// Pipeline: receive error events and trigger fix flow
app.route("/api", pipelineRouter);

// tRPC config API
app.route("/trpc", trpcRouter);

// ─── Start ─────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "3200", 10);
const DB_DIR = process.env.DB_DIR ?? resolve(process.cwd(), ".x-tinker/db");

console.log(`[x-tinker] Initializing database at ${DB_DIR}`);
await createDb(DB_DIR);
console.log(`[x-tinker] Database ready`);

serve(app, PORT);

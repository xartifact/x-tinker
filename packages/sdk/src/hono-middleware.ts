import type { MiddlewareHandler } from "hono";
import type { ErrorReporterConfig } from "./types.js";
import { ErrorReporter } from "./reporter.js";

/**
 * Create a Hono error middleware that captures uncaught request errors
 * and reports them to the x-tinker server.
 *
 * Usage:
 * ```ts
 * import { createHonoErrorMiddleware } from "@xartifact/x-tinker-sdk";
 *
 * app.use("*", createHonoErrorMiddleware({
 *   serverUrl: "http://localhost:3200",
 *   projectId: "x-llm-gateway",
 * }));
 * ```
 */
export function createHonoErrorMiddleware(config: ErrorReporterConfig): MiddlewareHandler {
  const reporter = new ErrorReporter(config);

  return async (c, next) => {
    try {
      await next();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // Report asynchronously — don't block the response
      reporter.report(err).catch(() => {});
      // Re-throw for the existing error handler to process
      throw error;
    }
  };
}